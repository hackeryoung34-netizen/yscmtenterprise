const { timingSafeEqual, createHmac, createHash, randomUUID } = require("node:crypto");
const { getRevenueSql } = require("./_lib/revenue-db");
const { getRevenueStorage, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("./_lib/revenue-storage");
const adminOperations = require("./_lib/admin-operations");
const adminProducts = require("./_lib/admin-products");
const adminSiteContent = require("./_lib/admin-site-content");
const adminSystemSettings = require("./_lib/admin-system-settings");
const enterpriseModules = require("./_lib/enterprise-modules");
const billing = require("./_lib/billing");

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
async function limited(sql,ip,feature){
  const secret=process.env.REVENUE_RATE_LIMIT_SECRET||"";
  if(secret){
    const hash=createHmac("sha256",secret).update(ip).digest("hex");
    const rows=await sql`with cleanup as (
      delete from public.revenue_submission_rate_limits
      where window_started_at < now()-interval '48 hours'
    )
    insert into public.revenue_submission_rate_limits(ip_hash,feature,window_started_at,submission_count)
    values(${hash},${feature},now(),1)
    on conflict(ip_hash,feature) do update set
      window_started_at=case when public.revenue_submission_rate_limits.window_started_at<=now()-interval '1 hour' then now() else public.revenue_submission_rate_limits.window_started_at end,
      submission_count=case when public.revenue_submission_rate_limits.window_started_at<=now()-interval '1 hour' then 1 else public.revenue_submission_rate_limits.submission_count+1 end
    where public.revenue_submission_rate_limits.window_started_at<=now()-interval '1 hour'
      or public.revenue_submission_rate_limits.submission_count<3
    returning submission_count`;
    return rows.length===0;
  }
  const now=Date.now(),entry=recentSubmissions.get(ip);
  if(entry&&now-entry.started<3600000&&entry.count>=3)return true;
  if(!entry||now-entry.started>=3600000)recentSubmissions.set(ip,{started:now,count:1});
  else entry.count++;
  if(recentSubmissions.size>5000){for(const [k,v] of recentSubmissions)if(now-v.started>=3600000)recentSubmissions.delete(k);}
  return false;
}
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
  if(await limited(sql,ip,"business_directory"))return send(res,429,{error:"Too many submissions. Please try again later."});
  const name=clean(body.business_name,160),category=clean(body.category,40),description=clean(body.description,3000),state=clean(body.state,80),city=clean(body.city,100);
  if(body.public_contact_consent!==true&&body.public_contact_consent!=="true")return send(res,400,{error:"Confirm that you have permission to publish these business contact details."});
  const phone=clean(body.phone,30).replace(/[\s()-]/g,""),whatsapp=clean(body.whatsapp,30).replace(/[\s()-]/g,"")||null,email=clean(body.email,254)||null,website=clean(body.website_url,2048)||null;
  if(name.length<2||description.length<20)return send(res,400,{error:"Business name and a description of at least 20 characters are required."});
  if(!categories.has(category))return send(res,400,{error:"Select a valid business category."});
  if(!states.has(state))return send(res,400,{error:"Select a valid Nigerian state."});
  if(city.length<2)return send(res,400,{error:"Enter a valid city."});
  if(!/^\+?[0-9]{7,15}$/.test(phone)||(whatsapp&&!/^\+?[0-9]{7,15}$/.test(whatsapp)))return send(res,400,{error:"Enter a valid phone number."});
  if(!validEmail(email)||!validUrl(website))return send(res,400,{error:"Check the email address or website URL."});
  const slug=slugify(name)+"-"+Math.random().toString(36).slice(2,8);
  const rows=await sql`insert into public.business_directory_listings(business_name,slug,category,description,state,city,phone,whatsapp,email,website_url,public_contact_consent,public_contact_consent_at) values(${name},${slug},${category},${description},${state},${city},${phone},${whatsapp},${email},${website},true,now()) returning id,business_name,slug,status,created_at`;
  return send(res,201,{listing:rows[0],message:"Your listing has been submitted for review."});
}
async function admin(req,res,sql){
  const auth=await centralAdminAuth(req,sql);if(auth.error)return send(res,auth.status,{error:auth.error});
  const permission=req.method==="GET"?"directory.read":"directory.manage";
  if(!hasCentralPermission(auth,permission))return send(res,403,{error:"You do not have permission to manage Business Directory."});
  if(req.method==="GET"){
    const listings=await sql`select id,business_name,slug,category,description,state,city,phone,whatsapp,email,website_url,public_contact_consent,public_contact_consent_at,status,is_featured,featured_until,created_at,admin_notes from public.business_directory_listings order by created_at desc limit 200`;
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

const jobCategories = new Set(["technology","sales","administration","customer-service","finance","education","healthcare","skilled-trades","logistics","hospitality","other"]);
const employmentTypes = new Set(["full-time","part-time","contract","internship","temporary","remote"]);
function validDate(value){if(!value)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+"T00:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;}
function validSalary(value){return value===""||value===null||value===undefined||(Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=100000000000);}
async function jobs(req,res,sql){
  if(req.method==="GET"){
    const q=clean(req.query&&req.query.q,100),state=clean(req.query&&req.query.state,80),city=clean(req.query&&req.query.city,100),category=clean(req.query&&req.query.category,40),type=clean(req.query&&req.query.type,24);
    const page=Math.max(1,Math.min(10000,Number.parseInt(req.query&&req.query.page,10)||1)),limit=Math.max(1,Math.min(50,Number.parseInt(req.query&&req.query.limit,10)||20));
    if(category&&!jobCategories.has(category))return send(res,400,{error:"Invalid job category."});
    if(type&&!employmentTypes.has(type))return send(res,400,{error:"Invalid employment type."});
    const rows=await sql`select id,job_title,employer_name,description,category,employment_type,state,city,is_remote,salary_min,salary_max,salary_period,application_email,application_url,whatsapp,closing_date,created_at from public.job_ads where status='approved' and (closing_date is null or closing_date>=current_date) and (${state||null}::text is null or state ilike ${state||null}) and (${city||null}::text is null or city ilike ${city||null}) and (${category||null}::text is null or category=${category||null}) and (${type||null}::text is null or employment_type=${type||null}) and (${q||null}::text is null or job_title ilike ('%'||${q||null}||'%') or employer_name ilike ('%'||${q||null}||'%') or description ilike ('%'||${q||null}||'%')) order by created_at desc limit ${limit} offset ${(page-1)*limit}`;
    return send(res,200,{jobs:rows,page,limit});
  }
  if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return send(res,405,{error:"Method not allowed"});}
  const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};
  if(clean(body.website_confirm,200))return send(res,202,{accepted:true});
  const ip=String(req.headers["x-forwarded-for"]||req.socket&&req.socket.remoteAddress||"unknown").split(",")[0].trim();
  if(await limited(sql,ip,"job_ads"))return send(res,429,{error:"Too many submissions. Please try again later."});
  const title=clean(body.job_title,160),employer=clean(body.employer_name,160),description=clean(body.description,5000),category=clean(body.category,40),type=clean(body.employment_type,24),state=clean(body.state,80),city=clean(body.city,100);
  if(body.public_contact_consent!==true&&body.public_contact_consent!=="true")return send(res,400,{error:"Confirm that you have permission to publish these employer contact details."});
  const email=clean(body.application_email,254)||null,url=clean(body.application_url,2048)||null,whatsapp=clean(body.whatsapp,30).replace(/[\s()-]/g,"")||null;
  const min=body.salary_min===""||body.salary_min===undefined||body.salary_min===null?null:Number(body.salary_min),max=body.salary_max===""||body.salary_max===undefined||body.salary_max===null?null:Number(body.salary_max),period=clean(body.salary_period,16)||"monthly",closing=clean(body.closing_date,10)||null;
  if(title.length<3||employer.length<2||description.length<30)return send(res,400,{error:"Job title, employer name and a description of at least 30 characters are required."});
  if(!jobCategories.has(category)||!employmentTypes.has(type))return send(res,400,{error:"Select a valid job category and employment type."});
  if(!states.has(state)||city.length<2)return send(res,400,{error:"Select a valid Nigerian state and enter a city."});
  if(!validEmail(email)||!validUrl(url)||(!email&&!url&&!whatsapp))return send(res,400,{error:"Provide at least one valid application email, website link or WhatsApp number."});
  if(whatsapp&&!/^\+?[0-9]{7,15}$/.test(whatsapp))return send(res,400,{error:"Enter a valid WhatsApp number."});
  if(!validSalary(body.salary_min)||!validSalary(body.salary_max)||(min!==null&&max!==null&&max<min))return send(res,400,{error:"Check the salary range."});
  if(!["hourly","daily","weekly","monthly","yearly"].includes(period)||!validDate(closing))return send(res,400,{error:"Check the salary period or closing date."});
  const remote=body.is_remote===true||type==="remote";
  const inserted=await sql`insert into public.job_ads(job_title,employer_name,description,category,employment_type,state,city,is_remote,salary_min,salary_max,salary_period,application_email,application_url,whatsapp,closing_date,public_contact_consent,public_contact_consent_at) values(${title},${employer},${description},${category},${type},${state},${city},${remote},${min},${max},${period},${email},${url},${whatsapp},${closing},true,now()) returning id,job_title,employer_name,status,created_at`;
  return send(res,201,{job:inserted[0],message:"Your job advert has been submitted for review."});
}
async function adminJobs(req,res,sql){
  const auth=await centralAdminAuth(req,sql);if(auth.error)return send(res,auth.status,{error:auth.error});
  const permission=req.method==="GET"?"jobs.read":"jobs.manage";
  if(!hasCentralPermission(auth,permission))return send(res,403,{error:"You do not have permission to manage Job Ads."});
  if(req.method==="GET"){
    const listings=await sql`select id,job_title,employer_name,description,category,employment_type,state,city,is_remote,salary_min,salary_max,salary_period,application_email,application_url,whatsapp,public_contact_consent,public_contact_consent_at,status,closing_date,created_at,admin_notes from public.job_ads order by created_at desc limit 200`;
    return send(res,200,{jobs:listings});
  }
  if(req.method!=="PATCH"){res.setHeader("Allow","GET, PATCH");return send(res,405,{error:"Method not allowed"});}
  const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{},id=typeof body.id==="string"?body.id:"",status=typeof body.status==="string"?body.status:"",notes=typeof body.admin_notes==="string"?body.admin_notes.trim().slice(0,2000):null;
  if(!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:"A valid job advert ID is required."});
  if(!["approved","rejected","suspended"].includes(status))return send(res,400,{error:"Invalid moderation status."});
  const updated=await sql`update public.job_ads set status=${status},admin_notes=${notes},approved_at=case when ${status}='approved' then coalesce(approved_at,now()) else approved_at end where id=${id}::uuid returning id,job_title,employer_name,status,admin_notes,approved_at`;
  if(!updated[0])return send(res,404,{error:"Job advert not found."});
  await sql`insert into public.job_ad_audit_logs(job_ad_id,actor_user_id,action,details) values(${id}::uuid,${auth.user.id},${"job_"+status},${JSON.stringify({status,admin_notes:notes})}::jsonb)`;
  return send(res,200,{job:updated[0]});
}


const FEATURED_AMOUNT_KOBO = 500000;
function revenuePaystackSecret(){
  if(process.env.VERCEL_ENV!=="production")throw new Error("Live payments are available only on the production deployment.");
  const key=process.env.REVENUE_PAYSTACK_SECRET_KEY||"";
  if(!key.startsWith("sk_live_"))throw new Error("YSCMT live payment credentials are not configured.");
  return key;
}
function expectedPaystackDomain(){return "live";}
function safeHexEqual(actual,expected){
  if(typeof actual!=="string"||typeof expected!=="string"||!/^[a-f0-9]{128}$/i.test(actual)||!/^[a-f0-9]{128}$/i.test(expected))return false;
  const a=Buffer.from(actual,"hex"),b=Buffer.from(expected,"hex");
  return a.length===b.length&&timingSafeEqual(a,b);
}
function verifyWebhookSignature(req,rawBody){
  const signingSecret=process.env.REVENUE_PAYSTACK_WEBHOOK_SECRET||"";
  const liveSecret=process.env.REVENUE_PAYSTACK_SECRET_KEY||"";
  const modern=req.headers["paystack-signature"];
  if(modern&&signingSecret.startsWith("whsec_")){
    const fields=String(modern).split(",").map(x=>x.trim());
    const timestamp=fields.find(x=>x.startsWith("t="))?.slice(2);
    const signatures=fields.filter(x=>x.startsWith("v1=")).map(x=>x.slice(3).split(":").pop());
    const seconds=Number(timestamp);
    if(!Number.isSafeInteger(seconds)||Math.abs(Date.now()/1000-seconds)>300)return false;
    const expected=createHmac("sha512",signingSecret).update(timestamp+".").update(rawBody).digest("hex");
    return signatures.some(sig=>safeHexEqual(sig,expected));
  }
  const legacy=req.headers["x-paystack-signature"];
  if(legacy&&liveSecret.startsWith("sk_live_")){
    const expected=createHmac("sha512",liveSecret).update(rawBody).digest("hex");
    return safeHexEqual(String(legacy),expected);
  }
  return false;
}
async function readRawRequestBody(req){
  if(req._yscmtRawBody)return req._yscmtRawBody;
  const chunks=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>1024*1024)throw new Error("Request body too large.");
    chunks.push(Buffer.from(chunk));
  }
  const raw=Buffer.concat(chunks);
  req._yscmtRawBody=raw;
  if(raw.length&&!req.body){
    const type=String(req.headers["content-type"]||"").toLowerCase();
    if(type.includes("application/json")){
      try{req.body=JSON.parse(raw.toString("utf8"));}catch{throw new Error("Invalid JSON body.");}
    }
  }
  return raw;
}
async function featuredPaymentInit(req,res,sql){
  if(process.env.VERCEL_ENV!=="production")return send(res,403,{error:"Live payments are available only on the production website."});
  if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"Method not allowed"});}
  if(process.env.VERCEL_ENV==="production"&&process.env.REVENUE_PAYMENTS_ENABLED!=="true")return send(res,503,{error:"Featured Business checkout is temporarily unavailable while YSCMT completes payment setup."});
  const secret=revenuePaystackSecret();
  const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};
  const listingId=clean(body.listing_id,36),email=clean(body.email,254).toLowerCase();
  if(!/^[0-9a-f-]{36}$/i.test(listingId)||!validEmail(email)||!email)return send(res,400,{error:"A valid listing and contact email are required."});
  const ip=String(req.headers["x-forwarded-for"]||req.socket&&req.socket.remoteAddress||"unknown").split(",")[0].trim();
  if(await limited(sql,ip,"featured_checkout"))return send(res,429,{error:"Too many checkout attempts. Please try again later."});
  const listings=await sql`select id,business_name,email,status from public.business_directory_listings where id=${listingId}::uuid limit 1`;
  const listing=listings[0];
  if(!listing||listing.status!=="approved")return send(res,404,{error:"Only an approved business listing can be featured."});
  if(!listing.email||String(listing.email).trim().toLowerCase()!==email)return send(res,400,{error:"Use the contact email already shown on this approved listing."});
  const host=String(req.headers["x-forwarded-host"]||req.headers.host||"").split(",")[0].trim().toLowerCase().replace(/:\d+$/,"");
  if(!(host.endsWith(".vercel.app")||host==="yscmtenterprise.ng"||host==="www.yscmtenterprise.ng"))return send(res,400,{error:"Checkout can only start from an approved YSCMT website host."});
  const reference="YSCMTFEAT"+randomUUID().replace(/-/g,"");
  const inserted=await sql`insert into public.featured_business_payment_orders(listing_id,reference,customer_email,amount_kobo,currency,status) values(${listing.id}::uuid,${reference},${email},${FEATURED_AMOUNT_KOBO},'NGN','pending') returning id`;
  const orderId=inserted[0].id;
  try{
    const response=await fetch("https://api.paystack.co/transaction/initialize",{
      method:"POST",
      headers:{Authorization:"Bearer "+secret,"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify({email,amount:FEATURED_AMOUNT_KOBO,currency:"NGN",reference,
        callback_url:"https://"+host+"/business-directory/?featured_payment=1",
        metadata:{order_id:orderId,listing_id:listing.id,feature:"business_directory_featured",custom_fields:[{display_name:"Business",variable_name:"business_name",value:listing.business_name},{display_name:"Featured duration",variable_name:"duration",value:"30 days"}]}}),
      signal:AbortSignal.timeout(15000)
    });
    const result=await response.json();
    if(!response.ok||result.status!==true||!result.data||!/^https:\/\/checkout\.paystack\.com\//.test(result.data.authorization_url||""))throw new Error("Paystack could not initialize checkout.");
    return send(res,200,{authorization_url:result.data.authorization_url,reference,amount_kobo:FEATURED_AMOUNT_KOBO,currency:"NGN"});
  }catch{
    await sql`update public.featured_business_payment_orders set status='failed',updated_at=now() where id=${orderId}::uuid and status='pending'`;
    return send(res,502,{error:"Unable to start Paystack checkout. Please try again later."});
  }
}
async function featuredPaymentVerify(req,res,sql){
  if(process.env.VERCEL_ENV!=="production")return send(res,403,{error:"Live payment verification is available only on the production website."});
  if(req.method!=="GET"){res.setHeader("Allow","GET");return send(res,405,{error:"Method not allowed"});}
  const secret=revenuePaystackSecret();
  const reference=clean(req.query&&req.query.reference,100);
  if(!/^[A-Za-z0-9.=-]{12,100}$/.test(reference))return send(res,400,{error:"A valid payment reference is required."});
  const orders=await sql`select o.id,o.listing_id,o.reference,o.customer_email,o.amount_kobo,o.currency,o.status,l.business_name,l.status as listing_status,l.is_featured,l.featured_until from public.featured_business_payment_orders o join public.business_directory_listings l on l.id=o.listing_id where o.reference=${reference} limit 1`;
  const order=orders[0];
  if(!order)return send(res,404,{error:"This payment reference is not a YSCMT featured-listing order."});
  if(order.status==="paid")return send(res,200,{paid:true,featured:order.is_featured,featured_until:order.featured_until,business_name:order.business_name,message:order.is_featured?"Payment confirmed. Your listing is featured for 30 days.":"Payment was already recorded; contact YSCMT support for listing review."});
  if(order.status==="needs_review")return send(res,202,{paid:true,featured:false,message:"Payment was received, but this listing needs administrator review. Please contact YSCMT support."});
  const response=await fetch("https://api.paystack.co/transaction/verify/"+encodeURIComponent(reference),{headers:{Authorization:"Bearer "+secret,Accept:"application/json"},signal:AbortSignal.timeout(15000)});
  if(!response.ok)return send(res,502,{error:"Paystack verification is temporarily unavailable. Please retry."});
  const result=await response.json(),payment=result&&result.data;
  if(!result.status||!payment||payment.reference!==reference)return send(res,502,{error:"Paystack did not return a valid verification response."});
  if(payment.status!=="success"){
    if(["failed","abandoned"].includes(payment.status))await sql`update public.featured_business_payment_orders set status='failed',updated_at=now() where reference=${reference} and status='pending'`;
    return send(res,409,{paid:false,payment_status:clean(payment.status,30),message:"Paystack has not confirmed a successful payment."});
  }
  if(!Number.isSafeInteger(Number(payment.id))||payment.domain!==expectedPaystackDomain()||payment.currency!=="NGN"||payment.amount!==FEATURED_AMOUNT_KOBO||order.amount_kobo!==FEATURED_AMOUNT_KOBO||order.currency!=="NGN"||!payment.customer||String(payment.customer.email||"").trim().toLowerCase()!==order.customer_email||!payment.metadata||payment.metadata.order_id!==order.id)return send(res,409,{paid:false,error:"Payment details do not match this YSCMT order. No featured access was granted."});
  const updated=await sql`with target as materialized (
    select o.id,o.listing_id,o.status,l.status as listing_status
    from public.featured_business_payment_orders o
    join public.business_directory_listings l on l.id=o.listing_id
    where o.reference=${reference}
    for update of o,l
  ), changed_order as (
    update public.featured_business_payment_orders o
    set status=case when t.listing_status='approved' then 'paid' else 'needs_review' end,
        paystack_transaction_id=${String(payment.id)},paid_at=coalesce(o.paid_at,now()),updated_at=now()
    from target t where o.id=t.id and t.status='pending'
    returning o.id,o.listing_id,o.status,o.paid_at
  ), changed_listing as (
    update public.business_directory_listings l
    set is_featured=true,featured_until=greatest(coalesce(l.featured_until,now()),now())+interval '30 days'
    from changed_order o where l.id=o.listing_id and o.status='paid'
    returning l.id,l.featured_until
  )
  select o.status,l.business_name,l.is_featured,l.featured_until
  from public.featured_business_payment_orders o
  join public.business_directory_listings l on l.id=o.listing_id
  where o.reference=${reference}`;
  const state=updated[0];
  if(!state)return send(res,503,{error:"Payment was verified but could not be applied. Contact YSCMT support with your reference."});
  if(state.status==="needs_review")return send(res,202,{paid:true,featured:false,message:"Payment was received, but this listing needs administrator review. Please contact YSCMT support."});
  return send(res,200,{paid:true,featured:state.is_featured,featured_until:state.featured_until,business_name:state.business_name,message:"Payment confirmed. Your listing is now featured for 30 days."});
}

async function featuredPaymentWebhook(req,res,sql){
  if(process.env.VERCEL_ENV!=="production")return send(res,403,{error:"Live payment webhooks are accepted only on production."});
  if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"Method not allowed"});}
  const raw=req._yscmtRawBody||Buffer.alloc(0);
  if(!raw.length||!verifyWebhookSignature(req,raw))return send(res,401,{error:"Invalid Paystack webhook signature."});
  let event;
  try{event=JSON.parse(raw.toString("utf8"));}catch{return send(res,400,{error:"Invalid webhook payload."});}
  const eventType=clean(event&&event.event,80)||"unknown";
  const reference=clean(event&&event.data&&event.data.reference,100)||null;
  if(reference&&reference.startsWith("YSCMTINV"))return await billing.invoiceWebhook(req,res,sql);
  const txid=Number.isSafeInteger(Number(event&&event.data&&event.data.id))?Number(event.data.id):null;
  const payloadHash=createHash("sha256").update(raw).digest("hex");
  const inserted=await sql`insert into public.featured_business_payment_webhook_events(payload_hash,event_type,reference,transaction_id,processing_status)
    values(${payloadHash},${eventType},${reference},${txid},'received')
    on conflict(payload_hash) do update set processing_status='received',received_at=now()
    where public.featured_business_payment_webhook_events.processing_status='failed'
       or (public.featured_business_payment_webhook_events.processing_status='received'
           and public.featured_business_payment_webhook_events.received_at<now()-interval '5 minutes')
    returning id`;
  if(!inserted.length)return send(res,200,{received:true,duplicate:true});
  const eventId=inserted[0].id;
  if(eventType!=="charge.success"||!reference){
    await sql`update public.featured_business_payment_webhook_events set processing_status='ignored',processed_at=now() where id=${eventId}`;
    return send(res,200,{received:true,ignored:true});
  }
  const fakeRes={
    statusCode:200,body:null,
    status(code){this.statusCode=code;return this;},
    setHeader(){return this;},
    send(value){try{this.body=JSON.parse(value);}catch{this.body={};}return this;}
  };
  let successful=false;
  try{
    await featuredPaymentVerify({method:"GET",query:{reference}},fakeRes,sql);
    successful=fakeRes.statusCode===200||fakeRes.statusCode===202;
  }catch{
    successful=false;
  }
  await sql`update public.featured_business_payment_webhook_events
    set processing_status=${successful?"processed":"failed"},processed_at=now() where id=${eventId}`;
  if(!successful)return send(res,500,{received:true,retry:true});
  return send(res,200,{received:true,processed:true});
}


async function centralAdminAuth(req,sql){
  const root=(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=process.env.SUPABASE_ANON_KEY||"";
  const auth=req.headers.authorization||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!root||!key||!token)return {error:"Administrator sign-in is required.",status:401};
  const response=await fetch(root+"/auth/v1/user",{headers:{apikey:key,Authorization:"Bearer "+token}});
  if(!response.ok)return {error:"Your session is invalid or expired.",status:401};
  const user=await response.json();
  const rows=await sql`select role,is_active,permissions from public.central_admin_roles where user_id=${user.id}::uuid limit 1`;
  const role=rows[0];
  if(!role||!role.is_active)return {error:"Central administrator access is not enabled for this account.",status:403};
  return {user,role:role.role,permissions:role.permissions||{}};
}
function centralRolePermissions(role){
  const permissions={
    super_admin:{"*":true},
    finance:{"revenue.read":true,"revenue.manage":true,"orders.read":true,"reports.read":true},
    content_manager:{"directory.read":true,"directory.manage":true,"jobs.read":true,"jobs.manage":true,"templates.read":true,"templates.manage":true,"content.manage":true},
    support_staff:{"chat.read":true,"chat.reply":true,"orders.lookup":true}
  };
  return permissions[role]||null;
}
function hasCentralPermission(auth,permission){
  const permissions=auth&&auth.permissions&&typeof auth.permissions==="object"?auth.permissions:{};
  return permissions["*"]===true||permissions[permission]===true;
}
async function centralAdminRoles(req,res,sql){
  const auth=await centralAdminAuth(req,sql);
  if(auth.error)return send(res,auth.status,{error:auth.error});
  if(auth.role!=="super_admin")return send(res,403,{error:"Only the Super Admin can manage staff roles."});
  if(req.method==="GET"){
    const rows=await sql`select user_id::text as user_id,role,is_active,permissions,created_at,updated_at from public.central_admin_roles order by created_at asc`;
    return send(res,200,{staff:rows});
  }
  if(req.method==="POST"){
    const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};
    const userId=clean(body.user_id,36),role=clean(body.role,30);
    if(!/^[0-9a-f-]{36}$/i.test(userId)||!["finance","content_manager","support_staff"].includes(role))return send(res,400,{error:"Enter a valid Supabase user ID and an assignable staff role."});
    if(userId===auth.user.id)return send(res,400,{error:"You cannot add yourself as another staff account."});
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
    const root=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
    if(!serviceKey)return send(res,503,{error:"Staff creation is not configured. Add SUPABASE_SERVICE_ROLE_KEY to Vercel Production environment variables."});
    const check=await fetch(root+"/auth/v1/admin/users/"+encodeURIComponent(userId),{headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey}});
    if(!check.ok)return send(res,404,{error:"No Supabase Auth user was found for that user ID."});
    const target=await check.json();
    const inserted=await sql`insert into public.central_admin_roles(user_id,role,is_active,permissions,created_by)
      values(${userId}::uuid,${role},true,${JSON.stringify(centralRolePermissions(role))}::jsonb,${auth.user.id}::uuid)
      on conflict(user_id) do nothing returning user_id::text as user_id,role,is_active,permissions,created_at,updated_at`;
    if(!inserted[0])return send(res,409,{error:"This user already has a central admin role."});
    await sql`insert into public.central_admin_audit_logs(actor_user_id,target_user_id,action,details)
      values(${auth.user.id}::uuid,${userId}::uuid,'role_created',${JSON.stringify({role,email:target.email||null})}::jsonb)`;
    return send(res,201,{staff:inserted[0]});
  }
  if(req.method==="PATCH"){
    const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};
    const userId=clean(body.user_id,36),role=body.role===undefined?null:clean(body.role,30),active=body.is_active;
    if(!/^[0-9a-f-]{36}$/i.test(userId)||userId===auth.user.id)return send(res,400,{error:"A valid staff user ID other than your own is required."});
    if(role!==null&&!["finance","content_manager","support_staff"].includes(role))return send(res,400,{error:"Only Finance, Content Manager or Support Staff can be assigned here. Super Admin access must be provisioned separately."});
    if(role===null&&typeof active!=="boolean")return send(res,400,{error:"Choose a valid role or active status change."});
    const existing=await sql`select role,is_active from public.central_admin_roles where user_id=${userId}::uuid limit 1`;
    if(!existing[0])return send(res,404,{error:"Staff account not found."});
    if(existing[0].role==="super_admin"&&(role&&role!=="super_admin"||active===false)){
      const count=await sql`select count(*)::int as total from public.central_admin_roles where role='super_admin' and is_active=true`;
      if(Number(count[0]?.total||0)<=1)return send(res,409,{error:"The last active Super Admin cannot be demoted or disabled."});
    }
    const nextRole=role||existing[0].role,nextActive=typeof active==="boolean"?active:existing[0].is_active;
    const updated=await sql`update public.central_admin_roles set role=${nextRole},is_active=${nextActive},permissions=${JSON.stringify(centralRolePermissions(nextRole))}::jsonb,updated_at=now() where user_id=${userId}::uuid returning user_id::text as user_id,role,is_active,permissions,created_at,updated_at`;
    await sql`insert into public.central_admin_audit_logs(actor_user_id,target_user_id,action,details)
      values(${auth.user.id}::uuid,${userId}::uuid,${nextActive?"role_updated":"role_disabled"},${JSON.stringify({previous_role:existing[0].role,role:nextRole,is_active:nextActive})}::jsonb)`;
    return send(res,200,{staff:updated[0]});
  }
  res.setHeader("Allow","GET, POST, PATCH");
  return send(res,405,{error:"Method not allowed"});
}

async function centralAdminReports(req,res,sql){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return send(res,405,{error:"Method not allowed"});}
  const auth=await centralAdminAuth(req,sql);
  if(auth.error)return send(res,auth.status,{error:auth.error});
  if(!hasCentralPermission(auth,"reports.read"))return send(res,403,{error:"You do not have permission to view revenue reports."});
  const [businesses,jobs,payments,marketplace,affiliates,advertising,communications,services,events,invoices,expenses,settlements]=await Promise.all([
    sql`select count(*)::int as total,
      count(*) filter(where status='pending')::int as pending,
      count(*) filter(where status='approved')::int as approved,
      count(*) filter(where status='rejected')::int as rejected,
      count(*) filter(where status='suspended')::int as suspended,
      count(*) filter(where is_featured and featured_until>now())::int as featured
      from public.business_directory_listings`,
    sql`select count(*)::int as total,
      count(*) filter(where status='pending')::int as pending,
      count(*) filter(where status='approved')::int as approved,
      count(*) filter(where status='rejected')::int as rejected,
      count(*) filter(where status='suspended')::int as suspended,
      count(*) filter(where status='expired' or (closing_date is not null and closing_date<current_date))::int as expired
      from public.job_ads`,
    sql`select count(*)::int as paid_orders,
      coalesce(sum(amount_kobo),0)::bigint as gross_kobo
      from public.featured_business_payment_orders where status='paid'`,
    sql`select count(*) filter(where status='completed')::int as completed_requests,
      coalesce(sum(commission_amount_ngn) filter(where status='completed'),0)::bigint as commission_receivable_ngn
      from public.service_marketplace_requests`,
    sql`select count(*) filter(where status='clicked')::int as clicks,
      count(*) filter(where status='converted')::int as converted,
      count(*) filter(where status='approved')::int as approved,
      count(*) filter(where status='paid')::int as paid,
      coalesce(sum(commission_amount_ngn) filter(where status in ('converted','approved')),0)::bigint as commission_payable_ngn,
      coalesce(sum(commission_amount_ngn) filter(where status='paid'),0)::bigint as commission_paid_ngn
      from public.affiliate_referrals`,
    sql`select count(*) filter(where status='active')::int as active_campaigns,
      count(*) filter(where status='pending')::int as pending_campaigns,
      coalesce(sum(budget_ngn) filter(where status in ('approved','active')),0)::bigint as declared_campaign_budget_ngn,
      coalesce(sum(impressions),0)::bigint as impressions,
      coalesce(sum(clicks),0)::bigint as clicks
      from public.advertiser_campaigns`,
    sql`select count(*) filter(where s.status='active')::int as active_subscriptions,
      coalesce(sum(p.monthly_price_ngn) filter(where s.status='active'),0)::bigint as plan_value_mrr_ngn
      from public.communications_subscriptions s join public.communications_plans p on p.id=s.plan_id`,
    sql`select count(*)::int as total_inquiries,
      count(*) filter(where status='quoted')::int as quoted,
      count(*) filter(where status='completed')::int as completed
      from public.digital_service_inquiries`,
    sql`select count(*)::int as total_requests,
      count(*) filter(where status='approved')::int as approved,
      coalesce(sum(budget_ngn),0)::bigint as customer_declared_budget_ngn
      from public.events_sponsorship_requests`,
    sql`select count(*)::int as total_invoices,count(*) filter(where status='paid')::int as paid_invoices,count(*) filter(where status in ('issued','pending') and due_at<current_date)::int as overdue_invoices,coalesce(sum(amount_ngn) filter(where status='paid'),0)::bigint as paid_invoice_ngn from public.enterprise_invoices`,
    sql`select coalesce(sum(amount_ngn) filter(where status='paid'),0)::bigint as paid_expenses_ngn,count(*) filter(where status='paid')::int as paid_expense_count from public.enterprise_expenses`,
    sql`select coalesce(sum(amount_ngn) filter(where status='paid'),0)::bigint as paid_settlements_ngn,coalesce(sum(amount_ngn) filter(where status='pending'),0)::bigint as pending_settlements_ngn from public.enterprise_settlements`
  ]);
  return send(res,200,{
    generated_at:new Date().toISOString(),
    business_directory:businesses[0]||{},
    job_ads:jobs[0]||{},
    featured_business_payments:payments[0]||{paid_orders:0,gross_kobo:0},
    marketplace_commissions:marketplace[0]||{},
    affiliate_commissions:affiliates[0]||{},
    advertising:advertising[0]||{},
    communications:communications[0]||{},
    digital_services:services[0]||{},
    events_sponsorship:events[0]||{},
    invoice_payments:invoices[0]||{},
    expenses:expenses[0]||{},
    settlements:settlements[0]||{},
    cash_summary:{gross_collected_ngn:Number(invoices[0]?.paid_invoice_ngn||0)+Number(payments[0]?.gross_kobo||0)/100,paid_expenses_ngn:Number(expenses[0]?.paid_expenses_ngn||0),paid_settlements_ngn:Number(settlements[0]?.paid_settlements_ngn||0),net_cash_before_gateway_fees_ngn:Number(invoices[0]?.paid_invoice_ngn||0)+Number(payments[0]?.gross_kobo||0)/100-Number(expenses[0]?.paid_expenses_ngn||0)-Number(settlements[0]?.paid_settlements_ngn||0)},
    currency:"NGN",
    financial_definitions:{
      confirmed_cash:"Verified paid featured-listing orders plus verified paid enterprise invoices.",
      commissions:"Marketplace commissions are receivables; affiliate commission payable excludes referrals marked paid.",
      pipeline:"Campaign budgets, customer-declared event budgets and communications plan value are pipeline indicators, not collected revenue.",
      profit:"Net cash before gateway fees is gross verified cash collected less recorded paid expenses and paid settlements. It is not statutory net profit; gateway fees, tax and unrecorded costs are excluded."
    }
  });
}
async function centralAdminActivity(req,res,sql){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return send(res,405,{error:"Method not allowed"});}
  const auth=await centralAdminAuth(req,sql);
  if(auth.error)return send(res,auth.status,{error:auth.error});
  if(!hasCentralPermission(auth,"activity.read"))return send(res,403,{error:"You do not have permission to view administrator activity."});
  const rows=await sql`select source,actor_user_id,action,details,created_at from (
    select 'Central Admin'::text as source,actor_user_id::text as actor_user_id,action,details,created_at
      from public.central_admin_audit_logs
    union all
    select 'Business Directory'::text as source,actor_user_id::text as actor_user_id,action,details,created_at
      from public.business_directory_audit_logs
    union all
    select 'Job Ads'::text as source,actor_user_id::text as actor_user_id,action,details,created_at
      from public.job_ad_audit_logs
    union all
    select 'Website Content'::text as source,actor_user_id::text as actor_user_id,action,details,created_at
      from public.site_content_audit_logs
  ) activity order by created_at desc limit 100`;
  return send(res,200,{activity:rows});
}
async function adminSession(req,res,sql){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return send(res,405,{error:"Method not allowed"});}
  const auth=await centralAdminAuth(req,sql);
  if(auth.error)return send(res,auth.status,{error:auth.error});
  return send(res,200,{authenticated:true,user:{id:auth.user.id,email:auth.user.email||null},role:auth.role,permissions:auth.permissions,role_management_enabled:auth.role==="super_admin"});
}
async function adminHealth(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"Method not allowed"});}
  const auth=await adminUser(req);if(auth.error)return send(res,auth.status,{error:auth.error});
  const result={ok:false,postgres:"error",object_storage:"error",cleanup:"not_needed"};
  try{const rows=await getRevenueSql()`select 1 as health_check`;if(Number(rows[0]?.health_check)===1)result.postgres="ok";}catch{}
  let uploaded=false,client,bucket,key,marker;
  try{
    ({client,bucket}=getRevenueStorage());
    key="health-check/"+randomUUID()+".txt";
    marker="yscmt-revenue-check:"+randomUUID();
    await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:marker,ContentType:"text/plain"}));
    uploaded=true;
    const response=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
    const received=await response.Body.transformToString();
    if(received!==marker)throw new Error("Object Storage read-back mismatch");
    result.object_storage="ok";
  }catch(error){console.error("[YSCMT revenue storage health check]",{name:error?.name,message:error?.message,statusCode:error?.$metadata?.httpStatusCode,code:error?.Code});result.object_storage="error";}
  finally{
    if(uploaded){
      try{await client.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));result.cleanup="ok";}
      catch{result.cleanup="error";}
    }
  }
  result.ok=result.postgres==="ok"&&result.object_storage==="ok"&&result.cleanup!=="error";
  return send(res,200,result);
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
  try{if(req.method==="POST"||req.method==="PATCH")await readRawRequestBody(req);}catch{return send(res,400,{error:"Invalid or oversized request body."});}
  const route=clean(req.query&&req.query.route,30);
  try{
    if(route==="admin-operations")return await adminOperations(req,res);
    if(route==="admin-products")return await adminProducts(req,res);
    if(route==="admin-site-content")return await adminSiteContent(req,res);
    if(route==="admin-system-settings")return await adminSystemSettings(req,res);
    if(route==="digital-services")return await enterpriseModules.digitalServices(req,res,getRevenueSql());
    if(route==="marketplace")return await enterpriseModules.marketplace(req,res,getRevenueSql());
    if(route==="advertising")return await enterpriseModules.advertising(req,res,getRevenueSql());
    if(route==="affiliates")return await enterpriseModules.affiliates(req,res,getRevenueSql());
    if(route==="affiliate-click")return await enterpriseModules.affiliateClick(req,res,getRevenueSql());
    if(route==="communications")return await enterpriseModules.communications(req,res,getRevenueSql());
    if(route==="events")return await enterpriseModules.events(req,res,getRevenueSql());
    if(route==="admin-enterprise-modules")return await enterpriseModules.adminModules(req,res,getRevenueSql());
    if(route==="admin-billing")return await billing.adminBilling(req,res,getRevenueSql());
    if(route==="customer-portal")return await billing.customerPortal(req,res,getRevenueSql());
    if(route==="customer-referral")return await billing.customerReferral(req,res,getRevenueSql());
    if(route==="customer-reviews")return await billing.customerReviews(req,res,getRevenueSql());
    if(route==="invoice")return await billing.publicInvoice(req,res,getRevenueSql());
    if(route==="invoice-webhook")return await billing.invoiceWebhook(req,res,getRevenueSql());
    if(route==="directory")return await directory(req,res,getRevenueSql());
    if(route==="admin-directory")return await admin(req,res,getRevenueSql());
    if(route==="health")return await health(req,res);
    if(route==="admin-health")return await adminHealth(req,res);
    if(route==="admin-reports")return await centralAdminReports(req,res,getRevenueSql());
    if(route==="admin-activity")return await centralAdminActivity(req,res,getRevenueSql());
    if(route==="admin-session")return await adminSession(req,res,getRevenueSql());
    if(route==="admin-roles")return await centralAdminRoles(req,res,getRevenueSql());
    if(route==="featured-init")return await featuredPaymentInit(req,res,getRevenueSql());
    if(route==="featured-verify")return await featuredPaymentVerify(req,res,getRevenueSql());
    if(route==="featured-webhook")return await featuredPaymentWebhook(req,res,getRevenueSql());
    if(route==="jobs")return await jobs(req,res,getRevenueSql());
    if(route==="admin-jobs")return await adminJobs(req,res,getRevenueSql());
    return send(res,404,{error:"Revenue route not found."});
  }catch{return send(res,503,{error:"YSCMT revenue service is temporarily unavailable."});}
};
module.exports.config={api:{bodyParser:false}};
