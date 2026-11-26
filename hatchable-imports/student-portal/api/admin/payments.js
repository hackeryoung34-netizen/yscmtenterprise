import { db, storage } from 'hatchable';
export const access = 'admin';
export const methods = ['GET','POST'];
export default async function(req,res){
 if(req.method==='GET'){
  const [settings,courses,payments,paystackPayments]=await Promise.all([
   db.query("SELECT setting_value FROM site_settings WHERE setting_key='bank_transfer'"),
   db.query('SELECT id,title,fee_amount,fee_currency,active FROM courses ORDER BY title'),
   db.query("SELECT p.id,p.enrolment_id,p.user_id,p.course_id,p.amount,p.currency,p.transfer_reference,p.storage_key,p.content_type,p.file_name,p.status,p.admin_note,p.submitted_at,c.title AS course_title,COALESCE(NULLIF(BTRIM(sp.full_name),''),u.name,u.email,'Student') AS student_name,u.email FROM payment_submissions p JOIN courses c ON c.id=p.course_id LEFT JOIN users u ON u.id=p.user_id LEFT JOIN student_profiles sp ON sp.user_id=p.user_id ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,p.submitted_at DESC LIMIT 300"),
   db.query("SELECT p.id,p.enrolment_id,p.user_id,p.course_id,p.reference,p.amount_kobo,p.currency,p.status,p.created_at,p.verified_at,c.title AS course_title,COALESCE(NULLIF(BTRIM(sp.full_name),''),u.name,u.email,'Student') AS student_name,u.email FROM paystack_payments p JOIN courses c ON c.id=p.course_id LEFT JOIN users u ON u.id=p.user_id LEFT JOIN student_profiles sp ON sp.user_id=p.user_id ORDER BY p.created_at DESC LIMIT 300")
  ]);
  const rows=await Promise.all(payments.rows.map(async p=>({ ...p,receipt_url:await storage.url(p.storage_key,{ttl:900}) })));
  return res.json({bank:settings.rows[0]?.setting_value||{},courses:courses.rows,payments:rows,paystack_payments:paystackPayments.rows});
 }
 const action=String(req.body?.action||'');
 if(action==='save_bank'){
  const bank_name=String(req.body?.bank_name||'').trim().slice(0,100);
  const account_name=String(req.body?.account_name||'').trim().slice(0,140);
  const account_number=String(req.body?.account_number||'').replace(/\s/g,'').slice(0,40);
  const instructions=String(req.body?.instructions||'').trim().slice(0,1000);
  if(!bank_name||!account_name||!account_number)return res.status(400).json({error:'Bank name, account name and account number are required.'});
  const value={bank_name,account_name,account_number,instructions};
  await db.query("INSERT INTO site_settings(setting_key,setting_value,updated_at) VALUES('bank_transfer',$1::jsonb,now()) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=now()",[JSON.stringify(value)]);
  await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,details) VALUES($1,$2,$3,$4::jsonb)',[String(req.member?.handle||'admin'),'bank_transfer_details_updated','site_settings',JSON.stringify({bank_name,account_number_last4:account_number.slice(-4)})]);
  return res.json({message:'Bank transfer details saved.',bank:value});
 }
 if(action==='set_fee'){
  const courseId=String(req.body?.course_id||'');
  const amount=Number(req.body?.fee_amount);
  const currency=String(req.body?.fee_currency||'NGN').toUpperCase();
  if(!/^[0-9a-f-]{36}$/i.test(courseId)||!Number.isSafeInteger(amount)||amount<0||amount>100000000||currency!=='NGN')return res.status(400).json({error:'Enter a whole-number course fee in NGN (Nigerian Naira).'});
  const updated=await db.query('UPDATE courses SET fee_amount=$1,fee_currency=$2 WHERE id=$3 RETURNING id,title,fee_amount,fee_currency',[amount,currency,courseId]);
  if(!updated.rows.length)return res.status(404).json({error:'Course not found.'});
  await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[String(req.member?.handle||'admin'),'course_fee_updated','course',courseId,JSON.stringify({fee_amount:amount,fee_currency:currency})]);
  return res.json({course:updated.rows[0],message:'Course fee updated.'});
 }
 if(action==='review'){
  const paymentId=String(req.body?.payment_id||'');
  const status=String(req.body?.status||'');
  const note=String(req.body?.admin_note||'').trim().slice(0,500);
  if(!/^[0-9a-f-]{36}$/i.test(paymentId)||!['verified','rejected'].includes(status))return res.status(400).json({error:'Invalid payment review.'});
  const target=await db.query("SELECT e.status FROM payment_submissions p JOIN enrollments e ON e.id=p.enrolment_id WHERE p.id=$1 AND p.status='pending'",[paymentId]);if(!target.rows.length)return res.status(409).json({error:'This payment has already been reviewed or does not exist.'});if(target.rows[0].status==='rejected')return res.status(409).json({error:'This enrolment was rejected. The student must request enrolment again before payment can be approved.'});
  const p=await db.query("UPDATE payment_submissions SET status=$1,admin_note=$2,reviewed_at=now() WHERE id=$3 AND status='pending' RETURNING id,enrolment_id,user_id,amount,currency",[status,note,paymentId]);
  if(!p.rows.length)return res.status(409).json({error:'This payment has already been reviewed or does not exist.'});
  if(status==='verified'){
   await db.query("UPDATE enrollments SET status='approved' WHERE id=$1 AND user_id=$2 AND status NOT IN ('completed','rejected')",[p.rows[0].enrolment_id,p.rows[0].user_id]);
  }
  await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[String(req.member?.handle||'admin'),'payment_'+status,'payment',paymentId,JSON.stringify({enrolment_id:p.rows[0].enrolment_id,user_id:p.rows[0].user_id,amount:p.rows[0].amount,currency:p.rows[0].currency,note})]);
  return res.json({payment:{id:paymentId,status},message:status==='verified'?'Payment verified. Course access has been activated.':'Payment rejected. Student may submit a corrected receipt.'});
 }
 return res.status(400).json({error:'Unknown payment action.'});
}