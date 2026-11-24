const { requireCentralAdmin } = require("./central-admin");

function send(res,status,body){return res.status(status).setHeader("Content-Type","application/json; charset=utf-8").setHeader("Cache-Control","no-store").send(JSON.stringify(body));}
const allowedKeys=["kicker","tagline","description","side_title","side_copy","cta_text","cta_href","pills","services","hero_slides","gallery_images"];
const defaults={
 services:[
  {title:"Software Development",description:"Websites, web applications, business platforms and custom software solutions."},
  {title:"Cybersecurity",description:"Security awareness, digital protection guidance and responsible cybersecurity learning."},
  {title:"IT Training",description:"Programming, computer skills and practical technology education."},
  {title:"Digital Solutions",description:"Digital tools, technology support and process improvements for organizations."}
 ],
 hero_slides:[
  {eyebrow:"WELCOME TO YSCMT ENTERPRISE",title:"Building a",highlight:"Smarter Digital Future.",description:"We create technology solutions, develop digital skills and help businesses turn bold ideas into meaningful results.",cta_text:"Explore Services",cta_href:"#services",secondary_text:"Work With Us",secondary_href:"#contact"},
  {eyebrow:"TECHNOLOGY • INNOVATION • OPPORTUNITY",title:"Learn Skills.",highlight:"Build Solutions.",description:"Practical IT training and digital solutions designed to help individuals, startups and organizations move forward.",cta_text:"Discover Training",cta_href:"#training",secondary_text:"About YSCMT",secondary_href:"#about"},
  {eyebrow:"YOUR DIGITAL GROWTH PARTNER",title:"Ideas Into",highlight:"Digital Impact.",description:"From software development to cybersecurity awareness, we help transform ideas into useful digital experiences.",cta_text:"Explore Projects",cta_href:"#projects",secondary_text:"Email Us",secondary_href:"mailto:yscmtenterprise@gmail.com"}
 ],
 gallery_images:[
  {src:"/images/yscmt-focus.jpg",alt:"YSCMT Enterprise founder working on a laptop and technology project",title:"Focused on Technology",caption:"Building practical digital skills and solutions"},
  {src:"/images/yscmt-workstation.jpg",alt:"YSCMT Enterprise founder in a workspace with a laptop",title:"Learning & Innovation",caption:"Growing through curiosity, creativity and persistence"}
 ]
};
function cleanContent(input){
  if(!input||typeof input!=="object"||Array.isArray(input))return {error:"Content must be an object."};
  const out={};
  for(const key of ["kicker","tagline","description","side_title","side_copy","cta_text","cta_href","pills"]){
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
  try{
  for(const key of ["services","hero_slides","gallery_images"]){
    if(input[key]===undefined)continue;
    const value=input[key],expected=defaults[key];
    if(!Array.isArray(value)||value.length!==expected.length)return {error:key.replaceAll("_"," ")+" must contain exactly "+expected.length+" items."};
    const fields=key==="services"?["title","description"]:key==="hero_slides"?["eyebrow","title","highlight","description","cta_text","cta_href","secondary_text","secondary_href"]:["src","alt","title","caption"];
    out[key]=value.map((item,index)=>{
      if(!item||typeof item!=="object"||Array.isArray(item))throw new Error("Invalid "+key+" item.");
      const clean={};
      for(const field of fields){
        const v=item[field],max=field==="description"||field==="caption"?500:field==="src"?180:field.endsWith("_href")?100:field==="alt"?220:160;
        if(typeof v!=="string"||!v.trim()||v.trim().length>max)throw new Error("Each "+key+" item needs valid "+field+".");
        clean[field]=v.trim();
      }
      if(key==="hero_slides"&&(!/^#[A-Za-z][\w-]{0,60}$/.test(clean.cta_href)||!/^#[A-Za-z][\w-]{0,60}$/.test(clean.secondary_href)&&!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.secondary_href)))throw new Error("Hero slide links must be same-page anchors or a valid email link.");
      if(key==="gallery_images"&&!/^\/images\/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp)$/i.test(clean.src))throw new Error("Gallery images must use a safe local /images/ file path.");
      return clean;
    });
  }
  }catch(error){return {error:error.message||"Invalid homepage content."};}
  return {content:{...defaults,...out}};
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
