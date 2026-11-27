import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET','POST'];
const validId = v => /^[0-9a-f-]{36}$/i.test(String(v || ''));
export default async function(req,res){
  const userId=String(req.user.id);
  const enrolled=await db.query("SELECT e.course_id,c.title FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=$1 AND e.status IN ('approved','completed')",[userId]);
  const courseIds=enrolled.rows.map(x=>x.course_id);
  if(req.method==='GET'){
    if(!courseIds.length)return res.json({courses:[],sessions:[],announcements:[],messages:[]});
    const [sessions,announcements,messages]=await Promise.all([
      db.query("SELECT s.id,s.course_id,c.title AS course_title,s.title,s.description,s.meeting_url,s.starts_at,s.ends_at,s.status,EXISTS(SELECT 1 FROM classroom_attendance a WHERE a.session_id=s.id AND a.user_id=$1) AS attended FROM classroom_sessions s JOIN courses c ON c.id=s.course_id WHERE s.course_id=ANY($2::uuid[]) AND s.status<>'cancelled' ORDER BY s.starts_at DESC LIMIT 100",[userId,courseIds]),
      db.query("SELECT a.id,a.course_id,c.title AS course_title,a.title,a.body,a.created_at FROM classroom_announcements a LEFT JOIN courses c ON c.id=a.course_id WHERE a.published=true AND (a.course_id IS NULL OR a.course_id=ANY($1::uuid[])) ORDER BY a.created_at DESC LIMIT 100",[courseIds]),
      db.query("SELECT m.id,m.course_id,m.author_role,m.message,m.created_at FROM classroom_messages m WHERE m.course_id=ANY($1::uuid[]) UNION ALL SELECT r.id,r.course_id,'teacher' AS author_role,r.message,r.created_at FROM classroom_teacher_replies r WHERE r.course_id=ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 100",[courseIds])
    ]);
    return res.json({courses:enrolled.rows,sessions:sessions.rows,announcements:announcements.rows,messages:messages.rows});
  }
  const action=String(req.body?.action||'');
  const courseId=String(req.body?.course_id||'');
  if(action==='message'){
    const message=String(req.body?.message||'').trim().slice(0,3000);
    if(!validId(courseId)||!courseIds.includes(courseId)||!message)return res.status(400).json({error:'Choose one of your approved courses and enter a message.'});
    const {rows}=await db.query("INSERT INTO classroom_messages(course_id,user_id,author_role,message) VALUES($1,$2,'student',$3) RETURNING id,course_id,author_role,message,created_at",[courseId,userId,message]);
    return res.status(201).json({message:rows[0]});
  }
  if(action==='join'){
    const sessionId=String(req.body?.session_id||'');
    if(!validId(sessionId))return res.status(400).json({error:'A valid class session is required.'});
    const found=await db.query("SELECT s.id,s.course_id,s.meeting_url,s.status FROM classroom_sessions s WHERE s.id=$1",[sessionId]);
    if(!found.rows.length)return res.status(404).json({error:'Class session not found.'});
    const session=found.rows[0];
    if(!courseIds.includes(session.course_id))return res.status(403).json({error:'This class is not part of your approved enrolments.'});
    if(session.status==='cancelled'||session.status==='completed')return res.status(409).json({error:'This class is no longer available.'});
    await db.query("INSERT INTO classroom_attendance(session_id,user_id) VALUES($1,$2) ON CONFLICT(session_id,user_id) DO NOTHING",[sessionId,userId]);
    return res.json({meeting_url:session.meeting_url,session_id:session.id});
  }
  return res.status(400).json({error:'Unknown classroom action.'});
}