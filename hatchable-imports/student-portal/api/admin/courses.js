import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET','POST','PATCH','PUT'];
export default async function(req,res){
  if(req.method==='GET'){
    const {rows}=await db.query('SELECT id,title,description,level,active,fee_amount,fee_currency,created_at FROM courses ORDER BY created_at DESC');
    return res.json({courses:rows});
  }
  if(req.method==='POST'){
    const title=String(req.body?.title||'').trim().slice(0,120);
    const description=String(req.body?.description||'').trim().slice(0,1000);
    const level=String(req.body?.level||'Beginner').trim().slice(0,40);
    if(!title)return res.status(400).json({error:'Course title is required.'});
    const {rows}=await db.query('INSERT INTO courses(title,description,level) VALUES($1,$2,$3) RETURNING id,title,description,level,active,fee_amount,fee_currency',[title,description,level]);
    await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[String(req.member?.handle||'admin'),'course_created','course',rows[0].id,JSON.stringify({title})]);
    return res.status(201).json({course:rows[0]});
  }
  const id=String(req.body?.course_id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Valid course is required.'});
  if(req.body?.fee_amount!==undefined){
    const fee=Number(req.body.fee_amount);
    const currency=String(req.body.fee_currency||'NGN').toUpperCase();
    if(!Number.isSafeInteger(fee)||fee<0||fee>100000000||currency!=='NGN')return res.status(400).json({error:'Enter a valid NGN course fee.'});
    const {rows}=await db.query('UPDATE courses SET fee_amount=$1,fee_currency=$2 WHERE id=$3 RETURNING id,title,fee_amount,fee_currency',[fee,currency,id]);
    if(!rows.length)return res.status(404).json({error:'Course not found.'});
    await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[String(req.member?.handle||'admin'),'course_fee_updated','course',id,JSON.stringify({fee_amount:fee,fee_currency:currency})]);
    return res.json({course:rows[0]});
  }
  const active=req.body?.active;
  if(typeof active!=='boolean')return res.status(400).json({error:'Provide a course fee or active status.'});
  const {rows}=await db.query('UPDATE courses SET active=$1 WHERE id=$2 RETURNING id,title,active,fee_amount,fee_currency',[active,id]);
  if(!rows.length)return res.status(404).json({error:'Course not found.'});
  await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[String(req.member?.handle||'admin'),'course_visibility_changed','course',id,JSON.stringify({active})]);
  return res.json({course:rows[0]});
}