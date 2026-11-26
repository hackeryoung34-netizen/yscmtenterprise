import { db, config } from 'hatchable';
import crypto from 'node:crypto';

export const access = 'user';
export const methods = ['POST'];

export default async function(req,res){
  const user=req.user;
  const enrolmentId=String(req.body?.enrolment_id||'');
  if(!/^[0-9a-f-]{36}$/i.test(enrolmentId))return res.status(400).json({error:'A valid enrolment is required.'});
  const q=await db.query("SELECT e.id,e.status,e.user_id,e.course_id,c.title,c.fee_amount,c.fee_currency FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.id=$1 AND e.user_id=$2 AND c.active=true",[enrolmentId,user.id]);
  if(!q.rows.length)return res.status(404).json({error:'Enrolment not found.'});
  const e=q.rows[0];
  if(['approved','completed'].includes(e.status))return res.status(409).json({error:'This course is already active for your account.'});
  if(e.status==='rejected')return res.status(409).json({error:'This enrolment was rejected. Please request enrolment again.'});
  if(String(e.fee_currency).toUpperCase()!=='NGN')return res.status(409).json({error:'Online Paystack payments are currently available for NGN course fees only.'});
  const amount=Number(e.fee_amount);
  if(!Number.isFinite(amount)||amount<=0)return res.status(409).json({error:'YSCMT Admin has not configured this course fee yet.'});
  const amountKobo=Math.round(amount*100);
  if(Math.abs(amountKobo/100-amount)>0.000001)return res.status(409).json({error:'The course fee must be set to a valid NGN amount.'});
  const paid=await db.query("SELECT id FROM paystack_payments WHERE enrolment_id=$1 AND user_id=$2 AND status='success' LIMIT 1",[enrolmentId,user.id]);
  if(paid.rows.length)return res.status(409).json({error:'This course payment has already been confirmed.'});
  const pending=await db.query("SELECT reference,authorization_url,created_at FROM paystack_payments WHERE enrolment_id=$1 AND user_id=$2 AND status='pending' ORDER BY created_at DESC LIMIT 1",[enrolmentId,user.id]);
  if(pending.rows.length){
    const existing=pending.rows[0];
    if(existing.authorization_url)return res.status(200).json({authorization_url:existing.authorization_url,reference:existing.reference,reused:true,message:'An existing payment session was found. Continue securely with Paystack.'});
    const ageMs=Date.now()-new Date(existing.created_at).getTime();
    if(Number.isFinite(ageMs)&&ageMs<5*60*1000)return res.status(409).json({error:'Your payment session is still being prepared. Please wait a few minutes and try again.'});
    await db.query("UPDATE paystack_payments SET status='failed' WHERE reference=$1 AND status='pending'",[existing.reference]);
  }
  const u=await db.query('SELECT email,name FROM users WHERE id=$1',[user.id]);
  const email=String(u.rows[0]?.email||user.email||'').trim();
  if(!email)return res.status(400).json({error:'Add a valid email address to your student account before paying.'});
  let secret;
  try{secret=String(await config.get('PAYSTACK_SECRET_KEY')||'').trim();}catch(err){console.error('Paystack setup is required.');return res.status(503).json({error:'Paystack is not configured yet. YSCMT Admin must complete the secure payment setup.'});}
  if(!secret||!/^sk_live_/.test(secret))return res.status(503).json({error:'Paystack secret key is missing or invalid. Please contact YSCMT Admin.'});
  const reference='YSCMT-'+crypto.randomUUID().replace(/-/g,'');
  await db.query("INSERT INTO paystack_payments(enrolment_id,user_id,course_id,reference,amount_kobo,currency,status) VALUES($1,$2,$3,$4,$5,'NGN','pending')",[enrolmentId,user.id,e.course_id,reference,amountKobo]);
  const origin='https://yscmt-student-portal.hatchable.site';
  const payload={email,amount:String(amountKobo),currency:'NGN',reference,callback_url:origin+'/payment-callback.html',metadata:{student_id:String(user.id),enrolment_id:enrolmentId,course_id:e.course_id,course_name:e.title,custom_fields:[{display_name:'Course',variable_name:'course',value:e.title},{display_name:'Registration ID',variable_name:'registration_id',value:String(user.id)}]}};
  try{
    const response=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(payload),timeout_ms:15000});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.status||!data?.data?.authorization_url) {
      await db.query("UPDATE paystack_payments SET status='failed',gateway_response=$1::jsonb WHERE reference=$2",[JSON.stringify({http_status:response.status,message:data?.message||'Initialization failed'}),reference]);
      console.error('Paystack initialization failed',{status:response.status});
      return res.status(502).json({error:'Paystack could not start the payment. Please try again later.'});
    }
    await db.query('UPDATE paystack_payments SET authorization_url=$1,gateway_response=$2::jsonb WHERE reference=$3',[data.data.authorization_url,JSON.stringify({message:data.message||'Authorization URL created'}),reference]);
    return res.status(201).json({authorization_url:data.data.authorization_url,reference,amount:amount.toFixed(2),currency:'NGN',course:e.title});
  }catch(err){
    await db.query("UPDATE paystack_payments SET status='failed' WHERE reference=$1",[reference]);
    console.error('Paystack initialization request failed.');
    return res.status(502).json({error:'Payment service is temporarily unavailable. Please try again.'});
  }
}