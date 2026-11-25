const { confirmPaidOrder } = require("./_lib/paystack");
const { getRevenueSql } = require("./_lib/revenue-db");
function send(res,status,body){res.status(status).setHeader("Content-Type","application/json; charset=utf-8").send(JSON.stringify(body));}
module.exports=async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"Method not allowed"});}
  const root=(process.env.SUPABASE_URL||"").replace(/\/$/,""),anonKey=process.env.SUPABASE_ANON_KEY;
  const authorization=req.headers.authorization||"",token=authorization.startsWith("Bearer ")?authorization.slice(7):"";
  const reference=req.body&&typeof req.body.reference==="string"?req.body.reference:"";
  if(!root||!anonKey||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.PAYSTACK_SECRET_KEY)return send(res,503,{error:"Payment verification is not configured yet."});
  if(!token||!/^yscmt-[0-9a-f-]{36}$/i.test(reference))return send(res,400,{error:"Sign in and provide a valid payment reference."});
  try{
    const headers={apikey:anonKey,Authorization:"Bearer "+token};
    const userResponse=await fetch(root+"/auth/v1/user",{headers});
    if(!userResponse.ok)return send(res,401,{error:"Your session is invalid or expired."});
    const user=await userResponse.json();
    const url=new URL(root+"/rest/v1/store_orders");
    url.searchParams.set("select","id,status,amount_ngn,currency");url.searchParams.set("user_id","eq."+user.id);
    url.searchParams.set("provider_reference","eq."+reference);url.searchParams.set("payment_provider","eq.paystack");url.searchParams.set("limit","1");
    const orderResponse=await fetch(url,{headers});
    if(!orderResponse.ok)return send(res,502,{error:"Unable to find your order."});
    const orders=await orderResponse.json(),order=orders[0];
    if(!order)return send(res,404,{error:"This payment reference is not linked to your account."});
    if(order.status==="paid")return send(res,200,{status:"paid",order_id:order.id,message:"Payment already confirmed."});
    const payment=await confirmPaidOrder(reference);
    if(payment.amount!==order.amount_ngn*100||payment.currency!==order.currency)return send(res,409,{error:"The verified payment amount does not match your order."});
    const referralId=payment.metadata&&typeof payment.metadata.affiliate_referral_id==="string"?payment.metadata.affiliate_referral_id:"";
    if(/^[0-9a-f-]{36}$/i.test(referralId)){
      try{
        const sql=getRevenueSql();
        await sql`update public.affiliate_referrals r
          set status='converted',order_reference=${reference},sale_amount_ngn=${order.amount_ngn},
              commission_amount_ngn=round(${order.amount_ngn}*p.commission_rate)::bigint,
              converted_at=coalesce(r.converted_at,now())
          from public.affiliate_partners p
          where r.id=${referralId}::uuid and p.id=r.partner_id and r.status='clicked' and p.status='approved'`;
      }catch(error){console.error("[affiliate conversion tracking] Could not record verified referral conversion.");}
    }
    return send(res,200,{status:"paid",order_id:order.id,message:"Payment verified. Your purchase is now available in your account."});
  }catch(e){return send(res,502,{error:e.message||"Payment verification failed. Please try again."});}
};