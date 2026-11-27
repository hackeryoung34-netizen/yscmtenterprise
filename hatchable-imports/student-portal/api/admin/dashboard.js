import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET'];
export default async function(req,res){
 const [students,courses,enrolments,pending,lessons,exams,attempts,passed,certificates,recent]=await Promise.all([
  db.query("SELECT COUNT(*)::int AS count FROM users WHERE email NOT LIKE '%@test.invalid'"),
  db.query('SELECT COUNT(*)::int AS count FROM courses WHERE active=true'),
  db.query('SELECT COUNT(*)::int AS count FROM enrollments'),
  db.query("SELECT COUNT(*)::int AS count FROM enrollments WHERE status='pending'"),
  db.query('SELECT COUNT(*)::int AS count FROM course_lessons WHERE active=true'),
  db.query('SELECT COUNT(*)::int AS count FROM course_exams WHERE active=true'),
  db.query('SELECT COUNT(*)::int AS count FROM exam_attempts'),
  db.query('SELECT COUNT(*)::int AS count FROM exam_attempts WHERE passed=true'),
  db.query('SELECT COUNT(*)::int AS count FROM student_certificates'),
  db.query("SELECT a.id,a.score,a.passed,a.submitted_at,e.title AS exam_title,c.title AS course_title,COALESCE(NULLIF(BTRIM(p.full_name),''),NULLIF(BTRIM(u.name),''),u.email,'Student') AS student_name FROM exam_attempts a JOIN course_exams e ON e.id=a.exam_id JOIN courses c ON c.id=e.course_id LEFT JOIN users u ON u.id=a.user_id LEFT JOIN student_profiles p ON p.user_id=a.user_id ORDER BY a.submitted_at DESC LIMIT 8")
 ]);
 const total=attempts.rows[0].count,success=passed.rows[0].count;
 return res.json({stats:{students:students.rows[0].count,courses:courses.rows[0].count,enrolments:enrolments.rows[0].count,pending:pending.rows[0].count,lessons:lessons.rows[0].count,exams:exams.rows[0].count,attempts:total,passed:success,passRate:total?Math.round(success*100/total):0,certificates:certificates.rows[0].count},recentAttempts:recent.rows});
}