const { createHmac, randomUUID } = require("node:crypto");
const { getRevenueSql } = require("./revenue-db");
const { requireCentralAdmin } = require("./central-admin");

function send(res,status,body){res.status(status).setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");return res.send(JSON.stringify(body));}
function clean(value,max){return typeof value==="string"?value.trim().slice(0,max):"";}
function emailOk(value){return value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
function urlOk(value,optional=false){if(!value)return optional;try{const u=new URL(value);return u.protocol==="https:"||u.protocol==="http:";}catch{return false;}}
function phoneOk(value){return /^\+?[0-9]{7,15}$/.test(value.replace(/[\s()-]/g,""));}
function ipOf(req){return String(req.headers["x-forwarded-for"]||req.socket&&req.socket.remoteAddress||"unknown").split(",")[0].trim();}
async function rateLimit(sql,req,feature){
  const secret=process.env.REVENUE_RATE_LIMIT_SECRET||"";
  if(!secret)return false;
  const hash=createHmac("sha256",secret).update(ipOf(req)).digest("hex");
  const rows=await sql`insert into public.revenue_submission_rate_limits(ip_hash,feature,window_started_at,submission_count)
    values(${hash},${feature},now(),1)
    on conflict(ip_hash,feature) do update set
      window_started_at=case when public.revenue_submission_rate_limits.window_started_at<=now()-interval '1 hour' then now() else public.revenue_submission_rate_limits.window_started_at end,
      submission_count=case when public.revenue_submission_rate_limits.window_started_at<=now()-interval '1 hour' then 1 else public.revenue_submission_rate_limits.submission_count+1 end
    where public.revenue_submission_rate_limits.window_started_at<=now()-interval '1 hour'
       or public.revenue_submission_rate_limits.submission_count<3
    returning submission_count`;
  return rows.length===0;
}
function slugify(value){return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70);}
function bodyOf(req){return req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};}

async function digitalServices(req,res,sql){
  const catalog=[
    {key:"website-development",name:"Website & Web App Development",description:"Business websites, portals, dashboards and custom web applications."},
    {key:"graphic-design",name:"Branding & Graphic Design",description:"Brand identity, logos, marketing graphics and social media designs."},
    {key:"cybersecurity",name:"Cybersecurity & Security Review",description:"Security assessments, hardening guidance and practical security support."},
    {key:"it-support",name:"IT Support & Computer Maintenance",description:"Computer setup, troubleshooting, maintenance and business IT support."},
    {key:"cloud-email",name:"Cloud, Domain & Business Email Setup",description:"Domain, DNS, business email and cloud deployment assistance."},
    {key:"social-media",name:"Social Media Management",description:"Content planning, page setup and ongoing digital presence management."}
  ];
  if(req.method==="GET")return send(res,200,{services:catalog});
  if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return send(res,405,{error:"Method not allowed"});}
  if(await rateLimit(sql,req,"digital_service_inquiry"))return send(res,429,{error:"Too many requests. Please try again later."});
  const b=bodyOf(req),name=clean(b.customer_name,120),email=clean(b.email,254).toLowerCase(),phone=clean(b.phone,24).replace(/[\s()-]/g,""),service=clean(b.service_key,50),description=clean(b.project_description,3000),budget=b.budget_ngn===""||b.budget_ngn==null?null:Number(b.budget_ngn);
  if(name.length<2||!emailOk(email)||!phoneOk(phone)||!catalog.some(x=>x.key===service)||description.length<20)return send(res,400,{error:"Enter your name, valid email and phone, choose a service, and describe the project in at least 20 characters."});
  if(budget!==null&&(!Number.isSafeInteger(budget)||budget<0||budget>100000000000))return send(res,400,{error:"Enter a valid budget or leave it blank."});
  const rows=await sql`insert into public.digital_service_inquiries(customer_name,email,phone,service_key,project_description,budget_ngn)
    values(${name},${email},${phone},${service},${description},${budget}) returning id,status,created_at`;
  return send(res,201,{inquiry:rows[0],message:"Your project request has been received. YSCMT will contact you after review."});
}

async function marketplace(req,res,sql){
  if(req.method==="GET"){
    const category=clean(req.query&&req.query.category,50),state=clean(req.query&&req.query.state,80),city=clean(req.query&&req.query.city,100),q=clean(req.query&&req.query.q,100);
    const rows=await sql`select id,business_name,slug,category,description,state,city,phone,whatsapp,email,website_url,service_tags,created_at
      from public.service_provider_profiles where status='approved'
      and (${category||null}::text is null or category=${category||null})
      and (${state||null}::text is null or state ilike ${state||null})
      and (${city||null}::text is null or city ilike ${city||null})
      and (${q||null}::text is null or business_name ilike ('%'||${q||null}||'%') or description ilike ('%'||${q||null}||'%'))
      order by created_at desc limit 100`;
    return send(res,200,{providers:rows});
  }
  if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return send(res,405,{error:"Method not allowed"});}
  const b=bodyOf(req),action=clean(b.action,20)||"request";
  if(await rateLimit(sql,req,"service_marketplace"))return send(res,429,{error:"Too many submissions. Please try again later."});
  if(action==="provider"){
    const name=clean(b.business_name,160),category=clean(b.category,60),description=clean(b.description,2500),state=clean(b.state,80),city=clean(b.city,100),phone=clean(b.phone,24).replace(/[\s()-]/g,""),whatsapp=clean(b.whatsapp,24).replace(/[\s()-]/g,""),email=clean(b.email,254).toLowerCase(),website=clean(b.website_url,2048),tags=Array.isArray(b.service_tags)?b.service_tags.filter(x=>typeof x==="string").slice(0,12).map(x=>clean(x,40)):[],consent=b.public_contact_consent===true||b.public_contact_consent==="true";
    if(name.length<2||category.length<2||description.length<30||state.length<2||city.length<2||!phoneOk(phone)||!emailOk(email)||!consent||!urlOk(website,true)||(whatsapp&&!phoneOk(whatsapp)))return send(res,400,{error:"Complete the provider details and confirm permission to publish the contact information."});
    const slug=slugify(name)+"-"+randomUUID().slice(0,6);
    const rows=await sql`insert into public.service_provider_profiles(business_name,slug,category,description,state,city,phone,whatsapp,email,website_url,service_tags)
      values(${name},${slug},${category},${description},${state},${city},${phone},${whatsapp||null},${email},${website||null},${tags})
      returning id,business_name,slug,status,created_at`;
    return send(res,201,{provider:rows[0],message:"Your service-provider application is pending review."});
  }
  const providerId=clean(b.provider_id,36),name=clean(b.requester_name,120),email=clean(b.requester_email,254).toLowerCase(),phone=clean(b.requester_phone,24).replace(/[\s()-]/g,""),description=clean(b.service_description,2500),state=clean(b.state,80),city=clean(b.city,100),budget=b.budget_ngn===""||b.budget_ngn==null?null:Number(b.budget_ngn);
  if(name.length<2||!emailOk(email)||!phoneOk(phone)||description.length<20||state.length<2||city.length<2)return send(res,400,{error:"Complete your contact details, location and service request."});
  if(budget!==null&&(!Number.isSafeInteger(budget)||budget<0))return send(res,400,{error:"Enter a valid budget or leave it blank."});
  if(providerId&&!/^[0-9a-f-]{36}$/i.test(providerId))return send(res,400,{error:"Invalid provider selection."});
  if(providerId){const found=await sql`select id from public.service_provider_profiles where id=${providerId}::uuid and status='approved' limit 1`;if(!found[0])return send(res,404,{error:"This service provider is not available."});}
  const rows=await sql`insert into public.service_marketplace_requests(provider_id,requester_name,requester_email,requester_phone,service_description,state,city,budget_ngn)
    values(${providerId||null}::uuid,${name},${email},${phone},${description},${state},${city},${budget}) returning id,status,created_at`;
  return send(res,201,{request:rows[0],message:"Your service request has been received."});
}

async function advertising(req,res,sql){
  if(req.method==="GET"){
    const placement=clean(req.query&&req.query.placement,30);
    const rows=await sql`with shown as materialized (
        select id from public.advertiser_campaigns
        where status='active' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())
          and (${placement||null}::text is null or placement=${placement||null})
        order by created_at desc limit 12
      ), bumped as (
        update public.advertiser_campaigns c set impressions=c.impressions+1,updated_at=now()
        from shown where c.id=shown.id returning c.id
      )
      select c.id,c.placement,c.headline,c.description,c.image_url,c.destination_url
      from public.advertiser_campaigns c join bumped b on b.id=c.id order by c.created_at desc`;
    return send(res,200,{campaigns:rows});
  }
  if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return send(res,405,{error:"Method not allowed"});}
  const b=bodyOf(req);
  if(clean(b.action,20)==="click"){
    const id=clean(b.campaign_id,36);
    if(!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:"Invalid campaign."});
    const rows=await sql`update public.advertiser_campaigns set clicks=clicks+1,updated_at=now()
      where id=${id}::uuid and status='active' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())
      returning destination_url`;
    if(!rows[0])return send(res,404,{error:"This campaign is no longer active."});
    return send(res,200,{tracked:true,destination_url:rows[0].destination_url});
  }
  if(await rateLimit(sql,req,"advertising_campaign"))return send(res,429,{error:"Too many submissions. Please try again later."});
  const company=clean(b.company_name,160),contact=clean(b.contact_name,120),email=clean(b.email,254).toLowerCase(),phone=clean(b.phone,24).replace(/[\s()-]/g,""),placement=clean(b.placement,30),headline=clean(b.headline,140),description=clean(b.description,1200),image=clean(b.image_url,2048),destination=clean(b.destination_url,2048),budget=b.budget_ngn===""||b.budget_ngn==null?null:Number(b.budget_ngn);
  if(company.length<2||contact.length<2||!emailOk(email)||!phoneOk(phone)||!["homepage","business-directory","jobs","services","marketplace"].includes(placement)||headline.length<5||description.length<20||!urlOk(destination)||!urlOk(image,true))return send(res,400,{error:"Complete the advertiser contact, placement, creative and valid destination URL."});
  if(budget!==null&&(!Number.isSafeInteger(budget)||budget<1000))return send(res,400,{error:"Enter an advertising budget of at least ₦1,000 or leave it blank for a quote."});
  const rows=await sql`insert into public.advertiser_campaigns(company_name,contact_name,email,phone,placement,headline,description,image_url,destination_url,budget_ngn)
    values(${company},${contact},${email},${phone},${placement},${headline},${description},${image||null},${destination},${budget})
    returning id,placement,headline,status,created_at`;
  return send(res,201,{campaign:rows[0],message:"Your advertising request is pending review. YSCMT will send a placement and payment quote."});
}

async function affiliates(req,res,sql){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"Method not allowed"});}
  if(await rateLimit(sql,req,"affiliate_application"))return send(res,429,{error:"Too many submissions. Please try again later."});
  const b=bodyOf(req),name=clean(b.full_name,120),email=clean(b.email,254).toLowerCase(),phone=clean(b.phone,24).replace(/[\s()-]/g,""),website=clean(b.website_url,2048),channels=Array.isArray(b.promotion_channels)?b.promotion_channels.filter(x=>typeof x==="string").slice(0,8).map(x=>clean(x,40)):[];
  if(name.length<2||!emailOk(email)||!phoneOk(phone)||!urlOk(website,true)||channels.length===0)return send(res,400,{error:"Enter your name, valid contact details and at least one promotion channel."});
  const code=(slugify(name).replace(/-/g,"").slice(0,12)||"partner")+randomUUID().replace(/-/g,"").slice(0,6).toUpperCase();
  try{
    const rows=await sql`insert into public.affiliate_partners(full_name,email,phone,website_url,promotion_channels,referral_code)
      values(${name},${email},${phone},${website||null},${channels},${code}) returning id,full_name,referral_code,status,created_at`;
    return send(res,201,{partner:rows[0],message:"Your affiliate application has been received. Referral links become active after approval."});
  }catch(error){if(String(error&&error.message||"").includes("affiliate_partners_email_key"))return send(res,409,{error:"An application already exists for this email."});throw error;}
}
async function affiliateClick(req,res,sql){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"Method not allowed"});}
  const b=bodyOf(req),code=clean(b.referral_code,40),path=clean(b.landing_path,300),referrer=clean(req.headers.referer,500);
  if(!/^[A-Za-z0-9-]{6,40}$/.test(code))return send(res,400,{error:"Invalid referral code."});
  const partner=await sql`select id from public.affiliate_partners where referral_code=${code} and status='approved' limit 1`;
  if(!partner[0])return send(res,404,{error:"This referral link is not active."});
  const secret=process.env.REVENUE_RATE_LIMIT_SECRET||"";
  const ipHash=secret?createHmac("sha256",secret).update(ipOf(req)).digest("hex"):null;
  const inserted=await sql`insert into public.affiliate_referrals(partner_id,referral_code,ip_hash,referrer,landing_path)
    values(${partner[0].id},${code},${ipHash},${referrer||null},${path||null}) returning id`;
  return send(res,200,{tracked:true,referral_id:inserted[0].id,referral_code:code});
}

async function communications(req,res,sql){
  if(req.method==="GET"){
    const plans=await sql`select id,slug,name,description,monthly_price_ngn,features from public.communications_plans where is_active=true order by sort_order asc`;
    return send(res,200,{plans,currency:"NGN",pricing:"Contact for a tailored quote"});
  }
  if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return send(res,405,{error:"Method not allowed"});}
  if(await rateLimit(sql,req,"communications_subscription"))return send(res,429,{error:"Too many submissions. Please try again later."});
  const b=bodyOf(req),plan=clean(b.plan_slug,30),name=clean(b.customer_name,120),business=clean(b.business_name,160),email=clean(b.email,254).toLowerCase(),phone=clean(b.phone,24).replace(/[\s()-]/g,""),team=b.team_size===""||b.team_size==null?null:Number(b.team_size),requirements=clean(b.requirements,2000);
  if(!["starter","growth","enterprise"].includes(plan)||name.length<2||business.length<2||!emailOk(email)||!phoneOk(phone)||(team!==null&&(!Number.isSafeInteger(team)||team<1||team>10000)))return send(res,400,{error:"Complete the business contact details and choose a valid plan."});
  const plans=await sql`select id from public.communications_plans where slug=${plan} and is_active=true limit 1`;
  if(!plans[0])return send(res,404,{error:"This communications plan is not available."});
  const rows=await sql`insert into public.communications_subscriptions(plan_id,customer_name,business_name,email,phone,team_size,requirements)
    values(${plans[0].id},${name},${business},${email},${phone},${team},${requirements||null}) returning id,status,created_at`;
  return send(res,201,{subscription:rows[0],message:"Your communications subscription request has been received. YSCMT will contact you with a service and payment quote."});
}

async function events(req,res,sql){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"Method not allowed"});}
  if(await rateLimit(sql,req,"events_sponsorship"))return send(res,429,{error:"Too many submissions. Please try again later."});
  const b=bodyOf(req),kind=clean(b.request_type,20),org=clean(b.organisation_name,160),contact=clean(b.contact_name,120),email=clean(b.email,254).toLowerCase(),phone=clean(b.phone,24).replace(/[\s()-]/g,""),title=clean(b.event_title,180),type=clean(b.event_type,30),date=clean(b.event_date,10)||null,description=clean(b.description,2500),budget=b.budget_ngn===""||b.budget_ngn==null?null:Number(b.budget_ngn);
  if(!["host_event","sponsor_event"].includes(kind)||org.length<2||contact.length<2||!emailOk(email)||!phoneOk(phone)||title.length<3||!["webinar","conference","workshop","training","exhibition","community","other"].includes(type)||description.length<30)return send(res,400,{error:"Complete the organisation, contact, event type, title and description."});
  if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+"T00:00:00.000Z").toISOString().slice(0,10)!==date))return send(res,400,{error:"Enter a valid event date or leave it blank."});
  if(budget!==null&&(!Number.isSafeInteger(budget)||budget<0))return send(res,400,{error:"Enter a valid budget or leave it blank."});
  const rows=await sql`insert into public.events_sponsorship_requests(request_type,organisation_name,contact_name,email,phone,event_title,event_type,event_date,budget_ngn,description)
    values(${kind},${org},${contact},${email},${phone},${title},${type},${date},${budget},${description}) returning id,status,created_at`;
  return send(res,201,{request:rows[0],message:"Your event or sponsorship enquiry has been received. YSCMT will contact you after review."});
}

async function adminModules(req,res,sql){
  const module=clean(req.query&&req.query.module,30);
  const permissions={services:"services.manage",marketplace:"marketplace.manage",advertising:"advertising.manage",affiliates:"affiliates.manage",communications:"communications.manage",events:"events.manage"};
  if(!permissions[module])return send(res,400,{error:"Choose a valid module."});
  if(!["GET","PATCH"].includes(req.method)){res.setHeader("Allow","GET, PATCH");return send(res,405,{error:"Method not allowed"});}
  const auth=await requireCentralAdmin(req,permissions[module]);
  if(auth.error)return send(res,auth.status,{error:auth.error});
  if(req.method==="GET"){
    let rows=[];
    if(module==="services")rows=await sql`select * from public.digital_service_inquiries order by created_at desc limit 200`;
    if(module==="marketplace"){
      const [providers,requests]=await Promise.all([
        sql`select * from public.service_provider_profiles order by created_at desc limit 200`,
        sql`select * from public.service_marketplace_requests order by created_at desc limit 200`
      ]);
      return send(res,200,{providers,requests});
    }
    if(module==="advertising")rows=await sql`select * from public.advertiser_campaigns order by created_at desc limit 200`;
    if(module==="affiliates"){
      const [partners,referrals]=await Promise.all([
        sql`select * from public.affiliate_partners order by created_at desc limit 200`,
        sql`select r.*,p.full_name as partner_name,p.commission_rate from public.affiliate_referrals r join public.affiliate_partners p on p.id=r.partner_id order by r.clicked_at desc limit 500`
      ]);
      return send(res,200,{partners,referrals});
    }
    if(module==="communications")rows=await sql`select s.*,p.slug as plan_slug,p.name as plan_name from public.communications_subscriptions s join public.communications_plans p on p.id=s.plan_id order by s.created_at desc limit 200`;
    if(module==="events")rows=await sql`select * from public.events_sponsorship_requests order by created_at desc limit 200`;
    return send(res,200,{items:rows});
  }
  const b=bodyOf(req),id=clean(b.id,36),status=clean(b.status,30),notes=clean(b.admin_notes,2000);
  if(!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:"A valid record ID is required."});
  const allowed={
    services:["new","contacted","quoted","in_progress","completed","cancelled"],
    marketplace:["pending","approved","rejected","suspended","new","contacted","accepted","completed","cancelled"],
    advertising:["pending","approved","active","paused","completed","rejected"],
    affiliates:["pending","approved","rejected","suspended","clicked","converted","void"],
    communications:["requested","quoted","pending_payment","active","past_due","cancelled"],
    events:["new","contacted","quoted","approved","completed","cancelled"]
  };
  if(!allowed[module].includes(status))return send(res,400,{error:"Invalid status for this module."});
  let updated;
  if(module==="services")updated=await sql`update public.digital_service_inquiries set status=${status},admin_notes=${notes||null},updated_at=now() where id=${id}::uuid returning id,status`;
  if(module==="marketplace"&&b.record_type==="provider")updated=await sql`update public.service_provider_profiles set status=${status},admin_notes=${notes||null},approved_at=case when ${status}='approved' then coalesce(approved_at,now()) else approved_at end,updated_at=now() where id=${id}::uuid returning id,status`;
  if(module==="marketplace"&&b.record_type==="request"){
    const rate=b.commission_rate===undefined||b.commission_rate===null||b.commission_rate===""?null:Number(b.commission_rate);
    const value=b.service_value_ngn===undefined||b.service_value_ngn===null||b.service_value_ngn===""?null:Number(b.service_value_ngn);
    if(rate!==null&&(!Number.isFinite(rate)||rate<0||rate>100))return send(res,400,{error:"Commission rate must be between 0 and 100 percent."});
    if(value!==null&&(!Number.isSafeInteger(value)||value<0))return send(res,400,{error:"Enter a valid completed service value in NGN."});
    if(status==="completed"&&(!Number.isSafeInteger(value)||value<=0))return send(res,400,{error:"Enter the completed service value in NGN before marking the request completed."});
    updated=await sql`update public.service_marketplace_requests
      set status=${status},service_value_ngn=coalesce(${value},service_value_ngn),
          commission_rate=coalesce(${rate===null?null:rate/100},commission_rate),
          commission_amount_ngn=case when coalesce(${value},service_value_ngn) is not null
            then round(coalesce(${value},service_value_ngn)*coalesce(${rate===null?null:rate/100},commission_rate))::bigint
            else commission_amount_ngn end,
          admin_notes=${notes||null},updated_at=now()
      where id=${id}::uuid returning id,status,provider_id,service_value_ngn,commission_rate,commission_amount_ngn`;
  }
  if(module==="advertising")updated=await sql`update public.advertiser_campaigns set status=${status},admin_notes=${notes||null},starts_at=case when ${status}='active' then coalesce(starts_at,now()) else starts_at end,updated_at=now() where id=${id}::uuid returning id,status`;
  if(module==="affiliates"&&b.record_type==="partner"){
    const rate=b.commission_rate===undefined||b.commission_rate===null||b.commission_rate===""?null:Number(b.commission_rate);
    if(rate!==null&&(!Number.isFinite(rate)||rate<0||rate>100))return send(res,400,{error:"Commission rate must be between 0 and 100 percent."});
    updated=await sql`update public.affiliate_partners set status=${status},commission_rate=coalesce(${rate===null?null:rate/100},commission_rate),admin_notes=${notes||null},approved_at=case when ${status}='approved' then coalesce(approved_at,now()) else approved_at end,updated_at=now() where id=${id}::uuid returning id,status,commission_rate`;
  }
  if(module==="affiliates"&&b.record_type==="referral"){
    const sale=b.sale_amount_ngn===undefined||b.sale_amount_ngn===null||b.sale_amount_ngn===""?null:Number(b.sale_amount_ngn);
    if(status==="converted"&&(!Number.isSafeInteger(sale)||sale<=0))return send(res,400,{error:"Enter the verified sale amount in NGN to record a conversion."});
    if(status==="paid")updated=await sql`update public.affiliate_referrals set status='paid',paid_at=coalesce(paid_at,now()) where id=${id}::uuid and status='approved' returning id,status,commission_amount_ngn`;
    else if(status==="approved")updated=await sql`update public.affiliate_referrals set status='approved' where id=${id}::uuid and status='converted' returning id,status,commission_amount_ngn`;
    else if(status==="converted")updated=await sql`update public.affiliate_referrals r set status='converted',sale_amount_ngn=${sale},commission_amount_ngn=round(${sale}*p.commission_rate)::bigint,converted_at=coalesce(r.converted_at,now()) from public.affiliate_partners p where r.id=${id}::uuid and p.id=r.partner_id and r.status='clicked' and p.status='approved' returning r.id,r.status,r.commission_amount_ngn`;
    else updated=await sql`update public.affiliate_referrals set status=${status} where id=${id}::uuid and status in ('clicked','converted','approved') returning id,status,commission_amount_ngn`;
  }
  if(module==="communications")updated=await sql`update public.communications_subscriptions set status=${status},admin_notes=${notes||null},updated_at=now() where id=${id}::uuid returning id,status`;
  if(module==="events")updated=await sql`update public.events_sponsorship_requests set status=${status},admin_notes=${notes||null},updated_at=now() where id=${id}::uuid returning id,status`;
  if(module==="marketplace"&&b.record_type==="request"&&status==="completed"&&updated[0].provider_id){
    const provider=await sql`select business_name from public.service_provider_profiles where id=${updated[0].provider_id}::uuid limit 1`;
    const gross=Number(updated[0].service_value_ngn||0),commission=Number(updated[0].commission_amount_ngn||0),net=gross-commission;
    if(provider[0]&&net>0){
      await sql`insert into public.enterprise_settlements(beneficiary_type,beneficiary_id,beneficiary_name,amount_ngn,notes,created_by,source_module,source_entity_id)
        values('provider',${updated[0].provider_id}::uuid,${provider[0].business_name},${net},${"Marketplace request "+id+" · gross ₦"+gross+" · YSCMT commission ₦"+commission},${auth.user.id}::uuid,'marketplace',${id}::uuid)
        on conflict(source_module,source_entity_id) where source_module is not null and source_entity_id is not null do nothing`;
    }
  }
  if(!updated||!updated[0])return send(res,404,{error:"Record not found or record type missing, or the requested status transition is not allowed."});
  await sql`insert into public.enterprise_module_audit_logs(actor_user_id,module,entity_id,action,details)
    values(${auth.user.id}::uuid,${module},${id}::uuid,${"status_"+status},${JSON.stringify({status,record_type:b.record_type||null,admin_notes:notes||null})}::jsonb)`;
  return send(res,200,{record:updated[0]});
}

module.exports={digitalServices,marketplace,advertising,affiliates,affiliateClick,communications,events,adminModules};
