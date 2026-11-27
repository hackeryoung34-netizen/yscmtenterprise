import { db } from 'hatchable';
export const access = 'user';
export const methods = ['POST'];
export default async function(req,res){
  const lessonId=String(req.body?.lesson_id||'');
  if(!/^[0-9a-f-]{36}$/i.test(lessonId))return res.status(400).json({error:'A valid lesson_id is required.'});
  const lesson=await db.query("SELECT l.id,l.course_id FROM course_lessons l JOIN enrollments e ON e.course_id=l.course_id WHERE l.id=$1 AND l.active=true AND e.user_id=$2 AND e.status IN ('approved','completed')",[lessonId,req.user.id]);
  if(!lesson.rows.length)return res.status(403).json({error:'You need an approved enrolment to update this lesson.'});
  const {rows}=await db.query('INSERT INTO lesson_progress(user_id,lesson_id) VALUES($1,$2) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed_at=now() RETURNING lesson_id,completed_at',[req.user.id,lessonId]);
  const summary=await db.query('SELECT COUNT(*)::int AS total,COUNT(p.id)::int AS completed FROM course_lessons l LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=$1 WHERE l.course_id=$2 AND l.active=true',[req.user.id,lesson.rows[0].course_id]);
  const s=summary.rows[0];
  return res.json({progress:rows[0],summary:{completed:s.completed,total:s.total,percent:s.total?Math.round(s.completed*100/s.total):0},message:'Lesson marked as completed.'});
}