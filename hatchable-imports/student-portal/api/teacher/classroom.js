import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET','POST','PATCH'];
const validId=v=>/^[0-9a-f-]{36}$/i.test(String(v||''));
const safeUrl=value=>{try{const u=new URL(String(value||''));return u.protocol==='https:'?u.toString():'';}catch{return '';}};
async function teacher(req,res){
 const role=await db.query('SELECT user_id FROM teacher_roles WHERE user_id=$1 AND active=true',[String(req.user.id)]);
 if(!role.rows.length){res.status(403).json({error:'Teacher access has not been assigned to this account. Contact the YSCMT administrator.'});return null;}
 const assigned=await db.query('SELECT c.id,c.title FROM teacher_course_assignments a JOIN courses c ON c.id=a.course_id WHERE a.teacher_id=$1 AND c.active=true ORDER BY c.title',[String(req.user.id)]);
 return assigned.rows;
}
export default async function(req,res){
 const courses=await teacher(req,res);if(!courses)return;
 const ids=courses.map(c=>c.id);
 if(req.method==='GET'){
  if(!ids.length)return res.json({courses,sessions:[],announcements:[],messages:[]});
  const [sessions,announcements,messages]=await Promise.all([
   db.query("SELECT s.id,s.course_id,c.title AS course_title,s.title,s.description,s.meeting_url,s.starts_at,s.ends_at,s.status,s.created_at,(SELECT COUNT(*)::int FROM classroom_attendance a WHERE a.session_id=s.id) AS attendance_count FROM classroom_sessions s JOIN courses c ON c.id=s.course_id WHERE s.course_id=ANY($1::uuid[]) ORDER BY s.starts_at DESC LIMIT 100",[ids]),
   db.query("SELECT a.id,a.course_id,c.title AS course_title,a.title,a.body,a.published,a.created_at FROM classroom_announcements a LEFT JOIN courses c ON c.id=a.course_id WHERE a.course_id IS NULL OR a.course_id=ANY($1::uuid[]) ORDER BY a.created_at DESC LIMIT 100",[ids]),
   db.query("SELECT m.id,m.course_id,c.title AS course_title,m.author_role,m.message,m.created_at FROM classroom_messages m JOIN courses c ON c.id=m.course_id WHERE m.course_id=ANY($1::uuid[]) UNION ALL SELECT r.id,r.course_id,c.title AS course_title,'teacher' AS author_role,r.message,r.created_at FROM classroom_teacher_replies r JOIN courses c ON c.id=r.course_id WHERE r.course_id=ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 100",[ids])
  ]);
  return res.json({courses,sessions:sessions.rows,announcements:announcements.rows,messages:messages.rows});
 }
 if(req.method==='POST'){
  const action=String(req.body?.action||'');
  const courseId=String(req.body?.course_id||'');
  if(action==='create_session'){
   const title=String(req.body?.title||'').trim().slice(0,180),description=String(req.body?.description||'').trim().slice(0,3000),meeting=safeUrl(req.body?.meeting_url);
   const start=new Date(req.body?.starts_at),end=new Date(req.body?.ends_at);
   if(!ids.includes(courseId)||!title||!meeting||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)return res.status(400).json({error:'Choose an assigned course, title, secure meeting link and valid times.'});
   const {rows}=await db.query("INSERT INTO classroom_sessions(course_id,title,description,meeting_url,starts_at,ends_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,course_id,title,description,meeting_url,starts_at,ends_at,status",[courseId,title,description,meeting,start.toISOString(),end.toISOString(),String(req.user.id)]);
   return res.status(201).json({session:rows[0]});
  }
  if(action==='create_announcement'){
   const title=String(req.body?.title||'').trim().slice(0,180),body=String(req.body?.body||'').trim().slice(0,5000);
   if(!title||!body||!ids.includes(courseId))return res.status(400).json({error:'Enter a title and message and choose one assigned course.'});
   const {rows}=await db.query('INSERT INTO classroom_announcements(course_id,title,body,created_by) VALUES($1,$2,$3,$4) RETURNING id,course_id,title,body,published,created_at',[courseId||null,title,body,String(req.user.id)]);
   return res.status(201).json({announcement:rows[0]});
  }
  if(action==='reply'){
   const message=String(req.body?.message||'').trim().slice(0,3000);
   if(!ids.includes(courseId)||!message)return res.status(400).json({error:'Choose an assigned course and enter a reply.'});
   const {rows}=await db.query('INSERT INTO classroom_teacher_replies(course_id,created_by,message) VALUES($1,$2,$3) RETURNING id,course_id,message,created_at',[courseId,String(req.user.id),message]);
   return res.status(201).json({message:{...rows[0],author_role:'teacher'}});
  }
  return res.status(400).json({error:'Unknown classroom action.'});
 }
 const id=String(req.body?.session_id||''),status=String(req.body?.status||'');
 if(!validId(id)||!['scheduled','live','completed','cancelled'].includes(status))return res.status(400).json({error:'Valid class and status are required.'});
 const {rows}=await db.query('UPDATE classroom_sessions SET status=$1,updated_at=now() WHERE id=$2 AND course_id=ANY($3::uuid[]) RETURNING id,status',[status,id,ids]);
 if(!rows.length)return res.status(404).json({error:'Class not found in your assigned courses.'});
 return res.json({session:rows[0]});
}