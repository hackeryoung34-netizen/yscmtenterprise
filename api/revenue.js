const { timingSafeEqual } = require("node:crypto");
const { getRevenueSql } = require("./_lib/revenue-db");
const { getRevenueStorage, HeadBucketCommand } = require("./_lib/revenue-storage");

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.send(JSON.stringify(body));
}
const categories = new Set(["technology","education","professional-services","health","retail","food-hospitality","construction","transport","beauty-wellness","agriculture","other"]);
const states = new Set(["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"]);
const recentSubmissions = new Map();
function clean(value,max){return typeof value==="string"?value.trim().slice(0,max):"";}
function validEmail(value){return !value||(value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));}
function validUrl(value){if(!value)return true;if(value.length>2048)return false;try{const u=new URL(value);return u.protocol==="https:"||u.protocol==="http:";}catch{return false;}}
function slugify(value){return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90);}
function limited(ip){const now=Date.now(),entry=recentSubmissions.get(ip);if(entry&&now-entry.started<3600000&&entry.count>=3)return true;if(!entry||now-entry.started>=3600000)recentSubmissions.set(ip,{started:now,count:1});else entry.count++;if(recentSubmissions.size>5000){for(const [k,v] of recentSubmissions)if(now-v.started>=3600000)recentSubmissions.delete(k);}return false;}
async function adminUser(req){
  const root=(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=process.env.SUPABASE_ANON_KEY||"";
  const auth=req.headers.authorization||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!root||!key||!token)return {error:"Administrator sign-in is required.",status:401};
  const response=await fetch(root+"/auth/v1/user",{headers:{apikey:key,Authorization:"Bearer "+token}});
  if(!response.ok)return {error:"Your session is invalid or expired.",status:401};
  const user=await response.json();
  if(!user.app_metadata||user.app_metadata.role!=="store_admin")return {error:"Administrator permission is required.",status:403};
  return {user};
}
async function directory(req,res,sql){
  if(req.method==="GET"){
    const q=clean(req.query&&req.query.q,100),state=clean(req.query&&req.query.state,80),city=clean(req.query&&req.query.city,100),category=clean(req.query&&req.query.category,40);
    const page=Math.max(1,Math.min(10000,Number.parseInt(req.query&&req.query.page,10)||1)),limit=Math.max(1,Math.min(50,Number.parseInt(req.query&&req.query.limit,10)||20));
    if(category&&!categories.has(category))return send(res,400,{error:"Invalid category."});
    const rows=await sql`select id,business_name,slug,category,description,state,city,phone,whatsapp,email,website_url,logo_object_key,(is_featured and featured_until>now()) as featured,created_at from public.business_directory_listings where status='approved' and (${state||null}::text is null or state ilike ${state||null}) and (${city||null}::text is null or city ilike ${city||null}) and (${category||null}::text is null or category=${category||null}) and (${q||null}::text is null or business_name ilike ('%'||${q||null}||'%') or description ilike ('%'||${q||null}||'%')) order by (is_featured and featured_until>now()) desc,created_at desc limit ${limit} offset ${(page-1)*limit}`;
    return send(res,200,{listings:rows,page,limit});
  }
  if(req.method!=="POST") {res.setHeader("Allow","GET, POST");return send(res,405,{error:"Method not allowed"});}
  const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};
  if(clean(body.website_confirm,200))return send(res,202,{accepted:true});
  const ip=String(req.headers["x-forwarded-for"]||req.socket&&req.socket.remoteAddress||"unknown").split(",")[0].trim();
  if(limited(ip))return send(res,429,{error:"Too many submissions. Please try again later."});
  const name=clean(body.business_name,160),category=clean(body.category,40),description=clean(body.description,3000),state=clean(body.state,80),city=clean(body.city,100);
  const phone=clean(body.phone,30).replace(/[\s()-]/g,""),whatsapp=clean(body.whatsapp,30).replace(/[\s()-]/g,"")||null,email=clean(body.email,254)||null,website=clean(body.website_url,2048)||null;
  if(name.length<2||description.length<20)return send(res,400,{error:"Business name and a description of at least 20 characters are required."});
  if(!categories.has(category))return send(res,400,{error:"Select a valid business category."});
  if(!states.has(state))return send(res,400,{error:"Select a valid Nigerian state."});
  if(city.length<2)return send(res,400,{error:"Enter a valid city."});
  if(!/^\+?[0-9]{7,15}$/.test(phone)||(whatsapp&&!/^\+?[0-9]{7,15}$/.test(whatsapp)))return send(res,400,{error:"Enter a valid phone number."});
  if(!validEmail(email)||!validUrl(website))return send(res,400,{error:"Check the email address or website URL."});
  const slug=slugify(name)+"-"+Math.random().toString(36).slice(2,8);
  const rows=await sql`insert into public.business_directory_listings(business_name,slug,category,description,state,city,phone,whatsapp,email,website_url) values(${name},${slug},${category},${description},${state},${city},${phone},${whatsapp},${email},${website}) returning id,business_name,slug,status,created_at`;
  return send(res,201,{listing:rows[0],message:"Your listing has been submitted for review."});
}
async function admin(req,res,sql){
  const auth=await adminUser(req);if(auth.error)return send(res,auth.status,{error:auth.error});
  if(req.method==="GET"){
    const listings=await sql`select id,business_name,slug,category,state,city,phone,email,status,is_featured,featured_until,created_at,admin_notes from public.business_directory_listings order by created_at desc limit 200`;
    return send(res,200,{listings});
  }
  if(req.method!=="PATCH"){res.setHeader("Allow","GET, PATCH");return send(res,405,{error:"Method not allowed"});}
  const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{},id=typeof body.id==="string"?body.id:"",status=typeof body.status==="string"?body.status:"",notes=typeof body.admin_notes==="string"?body.admin_notes.trim().slice(0,2000):null;
  if(!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:"A valid listing ID is required."});
  if(!["approved","rejected","suspended"].includes(status))return send(res,400,{error:"Invalid moderation status."});
  const updated=await sql`update public.business_directory_listings set status=${status},admin_notes=${notes},approved_at=case when ${status}='approved' then coalesce(approved_at,now()) else approved_at end where id=${id}::uuid returning id,business_name,slug,status,admin_notes,approved_at`;
  if(!updated[0])return send(res,404,{error:"Listing not found."});
  await sql`insert into public.business_directory_audit_logs(listing_id,actor_user_id,action,details) values(${id}::uuid,${auth.user.id},${"listing_"+status},${JSON.stringify({status,admin_notes:notes})}::jsonb)`;
  return send(res,200,{listing:updated[0]});
}
function tokenOk(req){const expected=process.env.REVENUE_HEALTH_TOKEN||"",auth=req.headers.authorization||"",actual=auth.startsWith("Bearer ")?auth.slice(7):"";if(!expected||!actual)return false;const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
async function health(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return send(res,405,{error:"Method not allowed"});}
  if(!tokenOk(req))return send(res,401,{error:"Unauthorized"});
  const result={ok:false,postgres:"not_checked",object_storage:"not_checked"};
  try{await getRevenueSql()`select 1 as health_check`;result.postgres="ok";}catch{result.postgres="error";}
  try{const {client,bucket}=getRevenueStorage();await client.send(new HeadBucketCommand({Bucket:bucket}));result.object_storage="ok";}catch{result.object_storage="error";}
  result.ok=result.postgres==="ok"&&result.object_storage==="ok";
  return send(res,result.ok?200:503,result);
}
module.exports=async function handler(req,res){
  const route=clean(req.query&&req.query.route,30);
  try{
    if(route==="directory")return await directory(req,res,getRevenueSql());
    if(route==="admin-directory")return await admin(req,res,getRevenueSql());
    if(route==="health")return await health(req,res);
    return send(res,404,{error:"Revenue route not found."});
  }catch{return send(res,503,{error:"YSCMT revenue service is temporarily unavailable."});}
};
