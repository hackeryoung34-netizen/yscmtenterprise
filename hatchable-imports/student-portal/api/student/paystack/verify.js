import { db, config } from 'hatchable';

export const access = 'user';
export const methods = ['POST'];

export default async function(req,res){
  const user=req.user;
  const reference=String(req.body?.reference||'').trim();
  if(!/^[A-Za-z0-9.=-]{8,120}$/.test(reference))return res.status(400).json({error:'A valid payment reference is required.'});
  const p=await db.query('SELECT id,enrolment_id,user_id,course_id,amount_kobo,currency,status FROM paystack_payments WHERE reference=$1 AND user_id=$2',[reference,user.id]);
  if(!p.rows.length)return res.status(404).json({error:'Payment reference was not found for this student.'});
  const payment=p.rows[0];
  if(payment.status==='success')return res.json({verified:true,message:'Payment already confirmed. Your course access is active.'});
  let secret;
  try{secret=String(await config.get('PAYSTACK_SECRET_KEY')||'').trim();}catch{return res.status(503).json({error:'Paystack verification is not configured yet.'});}
  if(!/^sk_live_/.test(secret))return res.status(503).json({error:'YSCMT requires a Paystack Live Secret Key. Test keys are disabled for real student payments.'});
  try{
    const response=await fetch('https://api.paystack.co/transaction/verify/'+encodeURIComponent(reference),{headers:{Authorization:'Bearer '+secret},timeout_ms:15000});
    const result=await response.json().catch(()=>null);
    const d=result?.data;
    if(!response.ok||!result?.status||!d)return res.status(502).json({error:'Could not verify this payment with Paystack yet. Please try again.'});
    const expectedDomain='live';
    if(d.status!=='success'||d.reference!==reference||Number(d.amount)!==Number(payment.amount_kobo)||String(d.currency).toUpperCase()!==payment.currency||d.domain!==expectedDomain){
      await db.query("UPDATE paystack_payments SET status=CASE WHEN $1='success' THEN status ELSE 'failed' END,gateway_response=$2::jsonb WHERE reference=$3 AND status='pending'",[String(d.status||''),JSON.stringify({status:d.status,amount:d.amount,currency:d.currency,domain:d.domain}),reference]);
      return res.status(409).json({verified:false,error:'Paystack has not confirmed the exact expected amount for this course. No course access was granted.'});
    }
    const changed=await db.query("UPDATE paystack_payments SET status='success',verified_at=now(),gateway_response=$1::jsonb WHERE reference=$2 AND status<>'success' RETURNING enrolment_id,user_id,course_id,amount_kobo",[JSON.stringify({status:d.status,amount:d.amount,currency:d.currency,paid_at:d.paid_at||d.paidAt||null,channel:d.channel||null}),reference]);
    if(changed.rows.length){
      const row=changed.rows[0];
      await db.query("UPDATE enrollments SET status='approved' WHERE id=$1 AND user_id=$2 AND course_id=$3 AND status NOT IN ('completed','rejected')",[row.enrolment_id,row.user_id,row.course_id]);
      await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',['paystack','payment_verified','payment',payment.id,JSON.stringify({reference,amount_kobo:row.amount_kobo,currency:'NGN',enrolment_id:row.enrolment_id})]);
    }
    return res.json({verified:true,message:'Payment verified successfully. Your course access is now active.'});
  }catch(err){
    console.error('Paystack verification request failed.');
    return res.status(502).json({error:'Payment verification is temporarily unavailable. Please try again.'});
  }
}