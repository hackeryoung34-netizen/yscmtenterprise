import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET','POST','PATCH'];
const validId = v => /^[0-9a-f-]{36}$/i.test(String(v||''));
export default async function(req,res){
  if(req.method==='GET'){
    const courseId=String(req.query?.course_id||'');
    if(!validId(courseId))return res.status(400).json({error:'A valid course_id is required.'});
    const {rows}=await db.query('SELECT id,course_id,title,content,video_url,sort_order,active,created_at FROM course_lessons WHERE course_id=$1 ORDER BY sort_order,created_at',[courseId]);
    return res.json({lessons:rows});
  }
  if(req.method==='POST'){
    const courseId=String(req.body?.course_id||'');
    const title=String(req.body?.title||'').trim().slice(0,160);
    const content=String(req.body?.content||'').trim().slice(0,20000);
    const videoUrl=String(req.body?.video_url||'').trim().slice(0,1000);
    const order=Math.max(1,Math.min(10000,Number.parseInt(req.body?.sort_order,10)||1));
    const active=req.body?.active===true;
    if(!validId(courseId)||!title)return res.status(400).json({error:'Choose a course and enter a lesson title.'});
    if(videoUrl){try{const u=new URL(videoUrl);if(!['https:','http:'].includes(u.protocol))throw new Error();}catch{return res.status(400).json({error:'Enter a valid http or https video URL.'});}}
    const exists=await db.query('SELECT id FROM courses WHERE id=$1',[courseId]);
    if(!exists.rows.length)return res.status(404).json({error:'Course not found.'});
    const {rows}=await db.query('INSERT INTO course_lessons(course_id,title,content,video_url,sort_order,active) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,course_id,title,content,video_url,sort_order,active',[courseId,title,content,videoUrl,order,active]);
    await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[String(req.member?.handle||'admin'),'lesson_created','lesson',rows[0].id,JSON.stringify({course_id:courseId,title,active})]);
    return res.status(201).json({lesson:rows[0]});
  }
  const id=String(req.body?.lesson_id||'');const active=req.body?.active;
  if(!validId(id)||typeof active!=='boolean')return res.status(400).json({error:'Valid lesson_id and active status are required.'});
  const {rows}=await db.query('UPDATE course_lessons SET active=$1,updated_at=now() WHERE id=$2 RETURNING id,active,title',[active,id]);
  if(!rows.length)return res.status(404).json({error:'Lesson not found.'});
  await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[String(req.member?.handle||'admin'),'lesson_visibility_changed','lesson',id,JSON.stringify({active})]);
  return res.json({lesson:rows[0]});
}