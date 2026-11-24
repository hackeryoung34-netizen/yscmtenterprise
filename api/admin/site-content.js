const { requireCentralAdmin } = require("../_lib/central-admin");

function send(res,status,body){return res.status(status).setHeader("Content-Type","application/json; charset=utf-8").send(JSON.stringify(body));}
const allowedKeys=["kicker","tagline","description","side_title","side_copy","cta_text","cta_href","pills"];
function cleanContent(input){
  if(!input||typeof input!=="object"||Array.isArray(input))return {error:"Content must be an object."};
  const out={};
  for(const key of allowedKeys){
    const value=input[key];
    if(key==="pills"){
      if(!Array.isArray(value)||value.length>6||value.some(v=>typeof v!=="string"||!v.trim()||v.trim().length>40))return {error:"Add up to six short banner labels."};
      out.pills=value.map(v=>v.trim());continue;
    }
    if(typeof value!=="string")return {error:key.replaceAll("_"," ")+" must be text."};
    const max=key==="description"||key==="side_copy"?500:key==="cta_href"?100:120;
    const trimmed=value.trim();
    if(!trimmed||trimmed.length>max)return {error:key.replaceAll("_"," ")+" is required and must be "+max+" characters or fewer."};
    out[key]=trimmed;
  }
  if(!/^#(?:[A-Za-z][\w-]{0,60})$/.test(out.cta_href))return {error:"CTA link must point to a section on this website, such as #services."};
  return {content:out};
}
module.exports=async function handler(req,res){
  if(!["GET","PUT"].includes(req.method)){res.setHeader("Allow","GET, PUT");return send(res,405,{error:"Method not allowed"});}
  const auth=await requireCentralAdmin(req,"content.manage");
  if(auth.error)return send(res,auth.status,{error:auth.error});
  const root=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!root||!key)return send(res,503,{error:"Website content storage is not configured. Add the server-side Supabase service key."});
  const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
  try{
    const url=new URL(root+"/rest/v1/site_content_pages");
    url.searchParams.set("page_key","eq.home");
    url.searchParams.set("select","page_key,content,status,updated_at,updated_by");
    if(req.method==="GET"){
      const response=await fetch(url,{headers});
      if(!response.ok)return send(res,502,{error:"Unable to load website content."});
      const rows=await response.json();
      return send(res,200,{page:rows[0]||null});
    }
    const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};
    if(!["draft","published"].includes(body.status))return send(res,400,{error:"Choose Draft or Published."});
    const cleaned=cleanContent(body.content);
    if(cleaned.error)return send(res,400,{error:cleaned.error});
    const previous=await fetch(url,{headers});
    if(!previous.ok)return send(res,502,{error:"Unable to read the current content version."});
    const oldRows=await previous.json();
    const action=body.status==="published"?"published":oldRows.length?"updated":"created";
    const saveUrl=new URL(root+"/rest/v1/site_content_pages");
    saveUrl.searchParams.set("on_conflict","page_key");
    const saved=await fetch(saveUrl,{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({page_key:"home",content:cleaned.content,status:body.status,updated_by:auth.user.id,updated_at:new Date().toISOString()})});
    if(!saved.ok)return send(res,502,{error:"Unable to save website content."});
    const rows=await saved.json();
    await fetch(root+"/rest/v1/site_content_audit_logs",{method:"POST",headers,body:JSON.stringify({page_key:"home",actor_user_id:auth.user.id,action,details:{status:body.status,fields:allowedKeys}})}).catch(()=>null);
    return send(res,200,{page:rows[0],message:body.status==="published"?"Homepage content published.":"Homepage content saved as draft."});
  }catch(error){console.error("[site content admin]",error&&error.message||"request failed");return send(res,502,{error:"Website content service is temporarily unavailable."});}
};
