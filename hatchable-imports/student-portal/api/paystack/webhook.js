import { db, config, webhooks } from 'hatchable';

export const access = 'public';
export const methods = ['POST'];

export default async function(req,res){
  const raw=req.rawBody;
  if(typeof raw!=='string'||!raw.length)return res.status(400).json({error:'Missing raw webhook body.'});
  const headers=req.headers||{};
  const paystackSignature=headers['paystack-signature']||'';
  const legacySignature=headers['x-paystack-signature']||'';
  let valid=false;
  if(paystackSignature){
    const parts=paystackSignature.split(',').map(x=>x.trim());
    const timestamp=parts.find(x=>x.startsWith('t='))?.slice(2);
    const signatures=parts.filter(x=>x.startsWith('v1=')).map(x=>x.slice(3).split(':').pop()).filter(Boolean);
    if(!timestamp||!/^\d{10}$/.test(timestamp)||!signatures.length)return res.status(401).json({error:'Invalid Paystack signature format.'});
    let secret;try{secret=String(await config.get('PAYSTACK_WEBHOOK_SECRET')||'').trim();}catch{return res.status(503).json({error:'Paystack webhook secret is not configured. Add it in Hatchable Setup.'});}if(!secret.startsWith('whsec_'))return res.status(503).json({error:'Paystack webhook secret is invalid. It must be the webhook signing secret, not a public key.'});
    for(const signature of signatures){
      try{
        const ok=await webhooks.verifyHmac({raw:timestamp+'.'+raw,signature,secret,algorithm:'sha512',encoding:'hex',timestamp,tolerance:300});
        if(ok){valid=true;break;}
      }catch{}
    }
  }else if(legacySignature){
    let secret;try{secret=String(await config.get('PAYSTACK_SECRET_KEY')||'').trim();}catch{return res.status(503).json({error:'Paystack secret key is not configured.'});}
    if(!/^sk_live_/.test(secret))return res.status(503).json({error:'Paystack Live Secret Key is required. Test keys are disabled.'});
    valid=await webhooks.verifyHmac({raw,signature:legacySignature,secret,algorithm:'sha512',encoding:'hex'});
  }
  if(!valid)return res.status(401).json({error:'Invalid Paystack webhook signature.'});
  const event=req.body||{};
  if(event.event!=='charge.success')return res.status(200).json({received:true,ignored:true});
  const d=event.data||{};
  const reference=String(d.reference||'');
  if(!reference)return res.status(200).json({received:true,ignored:true});
  const payment=await db.query('SELECT id,enrolment_id,user_id,course_id,amount_kobo,currency,status FROM paystack_payments WHERE reference=$1',[reference]);
  if(!payment.rows.length)return res.status(200).json({received:true,ignored:true});
  const p=payment.rows[0];
  let secret;try{secret=String(await config.get('PAYSTACK_SECRET_KEY')||'').trim();}catch{return res.status(503).json({error:'Paystack secret key is not configured.'});}
  if(!/^sk_(live|test)_/.test(secret))return res.status(503).json({error:'Paystack secret key is invalid.'});
  const expectedDomain='live';
  if(d.status!=='success'||Number(d.amount)!==Number(p.amount_kobo)||String(d.currency).toUpperCase()!==p.currency||d.domain!==expectedDomain){
    console.error('Paystack webhook did not match expected payment details.',{reference});
    return res.status(200).json({received:true,verified:false});
  }
  const changed=await db.query("UPDATE paystack_payments SET status='success',verified_at=now(),gateway_response=$1::jsonb WHERE reference=$2 AND status<>'success' RETURNING id,enrolment_id,user_id,course_id,amount_kobo",[JSON.stringify({status:d.status,amount:d.amount,currency:d.currency,paid_at:d.paid_at||d.paidAt||null,channel:d.channel||null}),reference]);
  if(changed.rows.length){
    const row=changed.rows[0];
    await db.query("UPDATE enrollments SET status='approved' WHERE id=$1 AND user_id=$2 AND course_id=$3 AND status NOT IN ('completed','rejected')",[row.enrolment_id,row.user_id,row.course_id]);
    await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',['paystack_webhook','payment_verified','payment',row.id,JSON.stringify({reference,amount_kobo:row.amount_kobo,currency:'NGN',enrolment_id:row.enrolment_id})]);
  }
  return res.status(200).json({received:true,verified:true});
}