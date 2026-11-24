const { requireCentralAdmin } = require("../_lib/central-admin");

function send(res,status,body){return res.status(status).setHeader("Content-Type","application/json; charset=utf-8").setHeader("Cache-Control","no-store").send(JSON.stringify(body));}
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
  const sql=auth.sql;
  try{
    if(req.method==="GET"){
      const rows=await sql`select page_key,content,draft_content,status,updated_at,updated_by::text as updated_by
        from public.site_content_pages where page_key='home' limit 1`;
      const row=rows[0];
      return send(res,200,{page:row?{page_key:row.page_key,content:row.draft_content||row.content,status:row.draft_content?"draft":row.status,updated_at:row.updated_at,updated_by:row.updated_by}:null});
    }
    const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};
    if(!["draft","published"].includes(body.status))return send(res,400,{error:"Choose Draft or Published."});
    const cleaned=cleanContent(body.content);
    if(cleaned.error)return send(res,400,{error:cleaned.error});
    const previous=await sql`select page_key from public.site_content_pages where page_key='home' limit 1`;
    const action=body.status==="published"?"published":previous.length?"updated":"created";
    let rows;
    if(body.status==="published"){
      rows=await sql`insert into public.site_content_pages(page_key,content,draft_content,status,updated_by,updated_at)
        values('home',${JSON.stringify(cleaned.content)}::jsonb,null,'published',${auth.user.id}::uuid,now())
        on conflict(page_key) do update set content=excluded.content,draft_content=null,status='published',updated_by=excluded.updated_by,updated_at=now()
        returning page_key,content,draft_content,status,updated_at,updated_by::text as updated_by`;
    }else{
      rows=await sql`insert into public.site_content_pages(page_key,draft_content,updated_by,updated_at)
        values('home',${JSON.stringify(cleaned.content)}::jsonb,${auth.user.id}::uuid,now())
        on conflict(page_key) do update set draft_content=excluded.draft_content,updated_by=excluded.updated_by,updated_at=now()
        returning page_key,content,draft_content,status,updated_at,updated_by::text as updated_by`;
    }
    await sql`insert into public.site_content_audit_logs(page_key,actor_user_id,action,details)
      values('home',${auth.user.id}::uuid,${action},${JSON.stringify({status:body.status,fields:allowedKeys})}::jsonb)`;
    const row=rows[0];
    return send(res,200,{page:row?{page_key:row.page_key,content:body.status==="published"?row.content:row.draft_content,status:body.status,updated_at:row.updated_at,updated_by:row.updated_by}:null,message:body.status==="published"?"Homepage content published.":"Draft saved. The live homepage remains unchanged."});
  }catch(error){console.error("[site content admin]",error&&error.message||"request failed");return send(res,503,{error:"Neon website content service is temporarily unavailable."});}
};
