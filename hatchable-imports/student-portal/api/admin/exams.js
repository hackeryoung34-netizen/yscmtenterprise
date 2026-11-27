import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET','POST','PATCH'];
const validId=v=>/^[0-9a-f-]{36}$/i.test(String(v||''));
export default async function(req,res){
 if(req.method==='GET'){
  const courseId=String(req.query?.course_id||'');if(!validId(courseId))return res.status(400).json({error:'A valid course_id is required.'});
  const {rows}=await db.query('SELECT e.id,e.course_id,e.title,e.instructions,e.duration_minutes,e.pass_mark,e.active,e.created_at,COUNT(q.id)::int AS question_count FROM course_exams e LEFT JOIN exam_questions q ON q.exam_id=e.id WHERE e.course_id=$1 GROUP BY e.id ORDER BY e.created_at DESC',[courseId]);return res.json({exams:rows});
 }
 if(req.method==='POST'){
  const courseId=String(req.body?.course_id||'');const title=String(req.body?.title||'').trim().slice(0,180);const instructions=String(req.body?.instructions||'').trim().slice(0,5000);const duration=Math.max(1,Math.min(240,Number.parseInt(req.body?.duration_minutes,10)||30));const pass=Math.max(0,Math.min(100,Number.parseInt(req.body?.pass_mark,10)||50));const questions=Array.isArray(req.body?.questions)?req.body.questions:[];
  if(!validId(courseId)||!title)return res.status(400).json({error:'Choose a course and enter an exam title.'});
  if(questions.length<1||questions.length>100)return res.status(400).json({error:'Add between 1 and 100 questions before saving.'});
  for(const q of questions){if(!String(q.question_text||'').trim()||!Array.isArray(q.options)||q.options.length!==4||q.options.some(x=>!String(x||'').trim())||![0,1,2,3].includes(Number(q.correct_option)))return res.status(400).json({error:'Each question needs text, four options and a correct answer.'});}
  const c=await db.query('SELECT id FROM courses WHERE id=$1',[courseId]);if(!c.rows.length)return res.status(404).json({error:'Course not found.'});
  const e=await db.query('INSERT INTO course_exams(course_id,title,instructions,duration_minutes,pass_mark) VALUES($1,$2,$3,$4,$5) RETURNING id,course_id,title,duration_minutes,pass_mark,active',[courseId,title,instructions,duration,pass]);const exam=e.rows[0];
  for(let i=0;i<questions.length;i++){const q=questions[i];await db.query('INSERT INTO exam_questions(exam_id,question_text,options,correct_option,sort_order) VALUES($1,$2,$3::jsonb,$4,$5)',[exam.id,String(q.question_text).trim().slice(0,2000),JSON.stringify(q.options.map(x=>String(x).trim().slice(0,500))),Number(q.correct_option),i+1]);}
  await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[String(req.member?.handle||'admin'),'exam_created','exam',exam.id,JSON.stringify({course_id:courseId,title,question_count:questions.length})]);return res.status(201).json({exam,question_count:questions.length,message:'Exam created as a draft. Publish it when ready.'});
 }
 const id=String(req.body?.exam_id||'');const active=req.body?.active;if(!validId(id)||typeof active!=='boolean')return res.status(400).json({error:'Valid exam_id and active status are required.'});
 const q=await db.query('SELECT COUNT(*)::int AS n FROM exam_questions WHERE exam_id=$1',[id]);if(active&&q.rows[0].n<1)return res.status(400).json({error:'Add questions before publishing this exam.'});
 const {rows}=await db.query('UPDATE course_exams SET active=$1,updated_at=now() WHERE id=$2 RETURNING id,title,active',[active,id]);if(!rows.length)return res.status(404).json({error:'Exam not found.'});await db.query('INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[String(req.member?.handle||'admin'),'exam_visibility_changed','exam',id,JSON.stringify({active})]);return res.json({exam:rows[0]});
}