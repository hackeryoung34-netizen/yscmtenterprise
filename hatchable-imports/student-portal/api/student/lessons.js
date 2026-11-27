import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET'];
export default async function(req,res){
  const courseId=String(req.query?.course_id||'');
  if(!/^[0-9a-f-]{36}$/i.test(courseId))return res.status(400).json({error:'A valid course_id is required.'});
  const enrol=await db.query("SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2 AND status IN ('approved','completed')",[req.user.id,courseId]);
  if(!enrol.rows.length)return res.status(403).json({error:'This course is not approved for your account yet.'});
  const {rows}=await db.query('SELECT l.id,l.course_id,l.title,l.content,l.video_url,l.sort_order,CASE WHEN p.id IS NULL THEN false ELSE true END AS completed,p.completed_at FROM course_lessons l LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=$1 WHERE l.course_id=$2 AND l.active=true ORDER BY l.sort_order,l.created_at',[req.user.id,courseId]);
  const completed=rows.filter(x=>x.completed).length;
  return res.json({lessons:rows,progress:{completed,total:rows.length,percent:rows.length?Math.round(completed*100/rows.length):0}});
}