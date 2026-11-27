import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['GET'];

export default async function(req, res) {
  const { rows } = await db.query(`
    SELECT
      e.id AS enrolment_id,
      e.status AS enrolment_status,
      e.enrolled_at,
      e.user_id,
      c.id AS course_id,
      c.title AS course_title,
      u.email,
      COALESCE(NULLIF(BTRIM(p.full_name), ''), NULLIF(BTRIM(u.name), ''), u.email, 'Student') AS student_name,
      COUNT(DISTINCT l.id)::int AS total_lessons,
      COUNT(DISTINCT lp.lesson_id)::int AS completed_lessons,
      CASE
        WHEN COUNT(DISTINCT l.id) = 0 THEN 0
        ELSE ROUND(COUNT(DISTINCT lp.lesson_id)::numeric * 100 / COUNT(DISTINCT l.id))::int
      END AS progress_percent,
      MAX(lp.completed_at) AS last_activity
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    LEFT JOIN users u ON u.id = e.user_id
    LEFT JOIN student_profiles p ON p.user_id = e.user_id
    LEFT JOIN course_lessons l ON l.course_id = c.id AND l.active = true
    LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = e.user_id
    WHERE e.status IN ('approved', 'completed')
    GROUP BY e.id, e.status, e.enrolled_at, e.user_id, c.id, c.title, u.email, p.full_name, u.name
    ORDER BY MAX(lp.completed_at) DESC NULLS LAST, student_name ASC
    LIMIT 500
  `);
  const total = rows.length;
  const started = new Set(rows.filter(row => Number(row.completed_lessons) > 0).map(row => row.user_id)).size;
  const average = total
    ? Math.round(rows.reduce((sum, row) => sum + Number(row.progress_percent || 0), 0) / total)
    : 0;
  return res.json({
    summary: { activeEnrolments: total, studentsStarted: started, averageProgress: average },
    progress: rows
  });
}