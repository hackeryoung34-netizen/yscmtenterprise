import { db, storage } from 'hatchable';
import crypto from 'node:crypto';
export const access = 'user';
export const methods = ['GET','POST'];
const validId=v=>/^[0-9a-f-]{36}$/i.test(String(v||''));
const mimeExt={'image/jpeg':'jpg','image/png':'png','application/pdf':'pdf'};
export default async function(req,res){
 const user=req.user;
 if(req.method==='GET'){
  const id=String(req.query?.enrolment_id||'');
  if(!validId(id))return res.status(400).json({error:'A valid enrolment is required.'});
  const q=await db.query("SELECT e.id AS enrolment_id,e.status AS enrolment_status,c.id AS course_id,c.title,c.fee_amount,c.fee_currency FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.id=$1 AND e.user_id=$2",[id,user.id]);
  if(!q.rows.length)return res.status(404).json({error:'Enrolment not found.'});
  const settings=await db.query("SELECT setting_value FROM site_settings WHERE setting_key='bank_transfer'");
  const bank=settings.rows[0]?.setting_value||{};
  const p=await db.query('SELECT id,amount,currency,transfer_reference,status,admin_note,submitted_at,reviewed_at FROM payment_submissions WHERE enrolment_id=$1 AND user_id=$2 ORDER BY submitted_at DESC LIMIT 1',[id,user.id]);
  return res.json({enrolment:q.rows[0],bank,payment:p.rows[0]||null});
 }
 const id=String(req.body?.enrolment_id||'');
 const reference=String(req.body?.transfer_reference||'').trim().slice(0,120);
 if(!validId(id)||!reference)return res.status(400).json({error:'Enrolment and bank transfer reference are required.'});
 const enrol=await db.query("SELECT e.id,e.user_id,e.course_id,e.status,c.fee_amount,c.fee_currency FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.id=$1 AND e.user_id=$2",[id,user.id]);
 if(!enrol.rows.length)return res.status(404).json({error:'Enrolment not found.'});
 const e=enrol.rows[0];
 if(['approved','completed'].includes(e.status))return res.status(409).json({error:'This course is already approved for your account.'});
 if(Number(e.fee_amount)<=0)return res.status(409).json({error:'The course fee has not been configured yet. Please contact YSCMT administration.'});
 const existing=await db.query('SELECT status FROM payment_submissions WHERE enrolment_id=$1 AND user_id=$2 ORDER BY submitted_at DESC LIMIT 1',[id,user.id]);if(existing.rows[0]?.status==='pending')return res.status(409).json({error:'A receipt is already awaiting Admin review.'});if(existing.rows[0]?.status==='verified')return res.status(409).json({error:'Your course payment has already been verified.'});
 const file=(req.files||[]).find(f=>f.field==='receipt');
 if(!file)return res.status(400).json({error:'Please attach your transfer receipt.'});
 if(file.buffer.length>5*1024*1024)return res.status(413).json({error:'Receipt must be 5 MB or smaller.'});
 const ext=mimeExt[file.contentType];
 if(!ext)return res.status(415).json({error:'Upload a JPG, PNG or PDF receipt only.'});
 const b=file.buffer;
 const valid=ext==='jpg'?(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff):ext==='png'?(b[0]===0x89&&b.toString('ascii',1,4)==='PNG'):(b.toString('ascii',0,5)==='%PDF-');
 if(!valid)return res.status(415).json({error:'The receipt file does not match its file type.'});
 const key='payment-receipts/'+user.id+'/'+crypto.randomUUID()+'.'+ext;
 await storage.put(key,b,file.contentType);
 const prior=await db.query("SELECT id,storage_key FROM payment_submissions WHERE enrolment_id=$1 AND user_id=$2 AND status='rejected' ORDER BY submitted_at DESC LIMIT 1",[id,user.id]);
 const inserted=await db.query("INSERT INTO payment_submissions(enrolment_id,user_id,course_id,amount,currency,transfer_reference,storage_key,content_type,file_name,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') RETURNING id,status,submitted_at",[id,user.id,e.course_id,e.fee_amount,e.fee_currency,reference,key,file.contentType,String(file.filename||'receipt').slice(0,180)]);
 return res.status(201).json({payment:inserted.rows[0],message:'Your payment receipt has been submitted. YSCMT Admin will review it before activating your course.'});
}