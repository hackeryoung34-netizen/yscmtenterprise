import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET','POST','PATCH'];
const validId = v => /^[0-9a-f-]{36}$/i.test(String(v || ''));
const safeUrl = value => { try { const u = new URL(String(value || '')); return u.protocol === 'https:' ? u.toString() : ''; } catch { return ''; } };
export default async function(req,res){
  if(req.method==='GET'){
    const [sessions,announcements,messages]=await Promise.all([
      db.query("SELECT s.id,s.course_id,c.title AS course_title,s.title,s.description,s.meeting_url,s.starts_at,s.ends_at,s.status,s.created_at,(SELECT COUNT(*)::int FROM classroom_attendance a WHERE a.session_id=s.id) AS attendance_count FROM classroom_sessions s JOIN courses c ON c.id=s.course_id ORDER BY s.starts_at DESC LIMIT 100"),
      db.query("SELECT a.id,a.course_id,c.title AS course_title,a.title,a.body,a.published,a.created_at FROM classroom_announcements a LEFT JOIN courses c ON c.id=a.course_id ORDER BY a.created_at DESC LIMIT 100"),
      db.query("SELECT m.id,m.course_id,c.title AS course_title,m.author_role,m.message,m.created_at FROM classroom_messages m JOIN courses c ON c.id=m.course_id UNION ALL SELECT r.id,r.course_id,c.title AS course_title,'teacher' AS author_role,r.message,r.created_at FROM classroom_teacher_replies r JOIN courses c ON c.id=r.course_id ORDER BY created_at DESC LIMIT 100")
    ]);
    return res.json({sessions:sessions.rows,announcements:announcements.rows,messages:messages.rows});
  }
  if(req.method==='POST'){
    const action=String(req.body?.action||'');
    if(action==='create_session'){
      const courseId=String(req.body?.course_id||'');
      const title=String(req.body?.title||'').trim().slice(0,180);
      const description=String(req.body?.description||'').trim().slice(0,3000);
      const meetingUrl=safeUrl(req.body?.meeting_url);
      const start=new Date(req.body?.starts_at);
      const end=new Date(req.body?.ends_at);
      if(!validId(courseId)||!title||!meetingUrl||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)return res.status(400).json({error:'Choose a course, title, secure meeting link and valid start/end times.'});
      const course=await db.query('SELECT id FROM courses WHERE id=$1 AND active=true',[courseId]);
      if(!course.rows.length)return res.status(404).json({error:'Active course not found.'});
      const {rows}=await db.query("INSERT INTO classroom_sessions(course_id,title,description,meeting_url,starts_at,ends_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,course_id,title,description,meeting_url,starts_at,ends_at,status",[courseId,title,description,meetingUrl,start.toISOString(),end.toISOString(),String(req.member?.handle||'admin')]);
      await db.query("INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,'classroom_session_created','classroom_session',$2,$3::jsonb)",[String(req.member?.handle||'admin'),rows[0].id,JSON.stringify({course_id:courseId,title})]);
      return res.status(201).json({session:rows[0]});
    }
    if(action==='create_announcement'){
      const courseId=req.body?.course_id?String(req.body.course_id):null;
      const title=String(req.body?.title||'').trim().slice(0,180);
      const body=String(req.body?.body||'').trim().slice(0,5000);
      if((courseId&&!validId(courseId))||!title||!body)return res.status(400).json({error:'Enter an announcement title and message, and choose a valid course or All students.'});
      if(courseId){const c=await db.query('SELECT id FROM courses WHERE id=$1',[courseId]);if(!c.rows.length)return res.status(404).json({error:'Course not found.'});}
      const {rows}=await db.query('INSERT INTO classroom_announcements(course_id,title,body,created_by) VALUES($1,$2,$3,$4) RETURNING id,course_id,title,body,published,created_at',[courseId,title,body,String(req.member?.handle||'admin')]);
      await db.query("INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,'classroom_announcement_created','classroom_announcement',$2,$3::jsonb)",[String(req.member?.handle||'admin'),rows[0].id,JSON.stringify({course_id:courseId,title})]);
      return res.status(201).json({announcement:rows[0]});
    }
    if(action==='reply'){
      const courseId=String(req.body?.course_id||'');
      const message=String(req.body?.message||'').trim().slice(0,3000);
      if(!validId(courseId)||!message)return res.status(400).json({error:'Choose a course and enter a reply.'});
      const c=await db.query('SELECT id FROM courses WHERE id=$1',[courseId]);if(!c.rows.length)return res.status(404).json({error:'Course not found.'});
      const {rows}=await db.query("INSERT INTO classroom_teacher_replies(course_id,created_by,message) VALUES($1,$2,$3) RETURNING id,course_id,message,created_at",[courseId,String(req.member?.handle||'admin'),message]);
      const reply={...rows[0],author_role:'teacher'};
      return res.status(201).json({message:reply});
    }
    return res.status(400).json({error:'Unknown classroom action.'});
  }
  const id=String(req.body?.session_id||'');
  const status=String(req.body?.status||'');
  if(!validId(id)||!['scheduled','live','completed','cancelled'].includes(status))return res.status(400).json({error:'Valid session and status are required.'});
  const {rows}=await db.query('UPDATE classroom_sessions SET status=$1,updated_at=now() WHERE id=$2 RETURNING id,status',[status,id]);
  if(!rows.length)return res.status(404).json({error:'Class session not found.'});
  await db.query("INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,'classroom_session_status_changed','classroom_session',$2,$3::jsonb)",[String(req.member?.handle||'admin'),id,JSON.stringify({status})]);
  return res.json({session:rows[0]});
}