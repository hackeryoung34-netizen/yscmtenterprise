import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET'];
export default async function(req,res){const {rows}=await db.query('SELECT e.id,e.course_id,e.status,e.enrolled_at,c.title,c.level,c.fee_amount,c.fee_currency,(SELECT p.status FROM payment_submissions p WHERE p.enrolment_id=e.id ORDER BY p.submitted_at DESC LIMIT 1) AS payment_status FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=$1 ORDER BY e.enrolled_at DESC',[req.user.id]);res.json({enrolments:rows});}