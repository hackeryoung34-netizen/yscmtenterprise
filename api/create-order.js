const crypto = require("crypto");
const { getRevenueSql } = require("./_lib/revenue-db");
function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}
module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "Method not allowed" }); }
  const root = (process.env.SUPABASE_URL || "").replace(/\/$/, ""), anonKey = process.env.SUPABASE_ANON_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "";
  if (!root || !anonKey || !paystackSecret || !process.env.SUPABASE_SERVICE_ROLE_KEY) return send(res, 503, { error: "Secure checkout is not configured yet. Please try again later." });
  const authorization = req.headers.authorization || "", accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const productId = typeof body.product_id === "string" ? body.product_id : "", purchaseType = body.purchase_type;
  const submittedReferralId=typeof body.affiliate_referral_id==="string"?body.affiliate_referral_id:"";
  let affiliateReferralId=null;
  if (!accessToken || !/^[0-9a-f-]{36}$/i.test(productId) || !["source_code","installation"].includes(purchaseType)) return send(res, 400, { error: "Sign in and provide a valid product and purchase type." });
  const headers = { apikey: anonKey, Authorization: "Bearer " + accessToken, "Content-Type": "application/json" };
  try {
    const userResponse = await fetch(root + "/auth/v1/user", { headers });
    if (!userResponse.ok) return send(res, 401, { error: "Your session is invalid or expired." });
    const user = await userResponse.json();
    if (!user.email) return send(res, 400, { error: "A verified email address is required for payment." });
    const productUrl = new URL(root + "/rest/v1/store_products");
    productUrl.searchParams.set("select","id,name,download_price_ngn,installation_price_ngn,artifact_path");
    productUrl.searchParams.set("id","eq."+productId); productUrl.searchParams.set("status","eq.published"); productUrl.searchParams.set("limit","1");
    const productResponse = await fetch(productUrl,{headers});
    if (!productResponse.ok) return send(res,502,{error:"Unable to verify this product."});
    const products=await productResponse.json(), product=products[0];
    if (!product) return send(res,404,{error:"This template is not available for purchase."});
    const amount=purchaseType==="source_code"?product.download_price_ngn:product.installation_price_ngn;
    if (!Number.isSafeInteger(amount)||amount<=0) return send(res,409,{error:"This purchase option is not available for payment yet."});
    const archivePath = product.artifact_path;
    if (typeof archivePath !== "string" || !archivePath.trim() ||
        archivePath.startsWith("/") || archivePath.split("/").includes("..") ||
        !archivePath.toLowerCase().endsWith(".zip")) {
      return send(res, 409, { error: "This template archive is not available for purchase yet." });
    }
    const encodedArchivePath = archivePath.split("/").map(encodeURIComponent).join("/");
    const archiveCheck = await fetch(root + "/storage/v1/object/info/template-archives/" + encodedArchivePath, {
      method: "GET",
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY }
    });
    if (archiveCheck.status === 404) {
      return send(res, 409, { error: "This template archive is temporarily unavailable. No payment has been created." });
    }
    if (!archiveCheck.ok) {
      console.error("[checkout archive verification]", archiveCheck.status);
      return send(res, 503, { error: "We could not verify the template archive. Please try again shortly." });
    }
    const orderResponse=await fetch(root+"/rest/v1/store_orders",{
      method:"POST",headers:{...headers,Prefer:"return=representation"},
      body:JSON.stringify({user_id:user.id,product_id:product.id,purchase_type:purchaseType,amount_ngn:amount,currency:"NGN",status:"pending"})
    });
    if (!orderResponse.ok) return send(res,502,{error:"Unable to create your pending order."});
    const orders=await orderResponse.json(),order=orders[0];
    if(!order)return send(res,502,{error:"The order service returned no order record."});
    if(/^[0-9a-f-]{36}$/i.test(submittedReferralId)){
      try{
        const sql=getRevenueSql();
        const referrals=await sql`select r.id from public.affiliate_referrals r join public.affiliate_partners p on p.id=r.partner_id where r.id=${submittedReferralId}::uuid and r.status='clicked' and p.status='approved' limit 1`;
        if(referrals[0])affiliateReferralId=referrals[0].id;
      }catch(error){console.warn("[affiliate attribution] Referral lookup skipped.");}
    }
    const reference="yscmt-"+crypto.randomUUID();
    const origin=process.env.STORE_PAYMENT_CALLBACK_URL || (process.env.VERCEL_ENV==="production"?"https://yscmtenterprise.ng/templates/payment-callback.html":(process.env.VERCEL_URL?"https://"+process.env.VERCEL_URL+"/templates/payment-callback.html":"https://yscmtenterprise.ng/templates/payment-callback.html"));
    const initResponse=await fetch("https://api.paystack.co/transaction/initialize",{
      method:"POST",headers:{Authorization:"Bearer "+paystackSecret,"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify({email:user.email,amount:amount*100,currency:"NGN",reference,callback_url:origin,metadata:{order_id:order.id,product_id:product.id,purchase_type:purchaseType,affiliate_referral_id:affiliateReferralId,custom_fields:[{display_name:"YSCMT Order",variable_name:"yscmt_order_id",value:order.id}]}})
    });
    const initialized=await initResponse.json();
    if(!initResponse.ok||!initialized.status||!initialized.data||!initialized.data.authorization_url||initialized.data.reference!==reference) return send(res,502,{error:"Paystack could not initialize this payment. No paid access has been granted."});
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    const attach=await fetch(root+"/rest/v1/rpc/store_set_paystack_reference",{
      method:"POST",headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"},body:JSON.stringify({p_order_id:order.id,p_reference:reference})
    });
    if(!attach.ok||(await attach.json())!==true) return send(res,502,{error:"Payment was initialized but could not be safely linked to your order. Please contact YSCMT support before paying again."});
    return send(res,201,{order_id:order.id,reference,amount_ngn:amount,currency:"NGN",status:"pending",authorization_url:initialized.data.authorization_url,message:"Continue to Paystack to complete your payment. Your order becomes paid only after server verification."});
  } catch { return send(res,502,{error:"Checkout is temporarily unavailable. Please try again later."}); }
};