import { db, config } from 'hatchable';

export const access = 'admin';
export const methods = ['GET'];

async function secretState(name, pattern) {
  try {
    const value = await config.get(name);
    const configured = typeof value === 'string' && value.length > 0;
    return {
      configured,
      valid: configured ? pattern.test(value) : false,
      needsSetup: false
    };
  } catch (error) {
    return { configured: false, valid: false, needsSetup: true };
  }
}

export default async function(req, res) {
  const [paystack, webhook, counts] = await Promise.all([
    secretState('PAYSTACK_SECRET_KEY', /^sk_live_/ ),
    secretState('PAYSTACK_WEBHOOK_SECRET', /^whsec_[A-Za-z0-9]+$/),
    db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM courses WHERE active=true) AS active_courses,
        (SELECT COUNT(*)::int FROM course_lessons WHERE active=true) AS active_lessons,
        (SELECT COUNT(*)::int FROM course_exams WHERE active=true) AS active_exams,
        (SELECT COUNT(*)::int FROM enrollments WHERE status='approved') AS approved_enrolments,
        (SELECT COUNT(*)::int FROM exam_attempts) AS exam_attempts,
        (SELECT COUNT(*)::int FROM student_certificates) AS certificates,
        (SELECT COUNT(*)::int FROM practice_submissions) AS practice_submissions,
        (SELECT COUNT(*)::int FROM practice_submissions WHERE status IN ('submitted','in_review')) AS practice_awaiting_review
    `)
  ]);
  return res.json({
    integrations: { paystack, webhook },
    learning: counts.rows[0] || {},
    checked_at: new Date().toISOString()
  });
}