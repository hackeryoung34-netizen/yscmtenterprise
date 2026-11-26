import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET','POST'];
const statuses = new Set(['in_review','approved','needs_changes']);
export default async function(req,res) {
  if (req.method === 'GET') {
    const { rows } = await db.query(`
      SELECT s.id,s.user_id,s.lab_key,s.title,s.submission_text,s.project_url,s.status,s.reviewer_notes,s.submitted_at,s.reviewed_at,
        COALESCE(NULLIF(BTRIM(p.full_name),''),NULLIF(BTRIM(u.name),''),u.email,'Student') AS student_name,
        u.email
      FROM practice_submissions s
      LEFT JOIN users u ON u.id=s.user_id
      LEFT JOIN student_profiles p ON p.user_id=s.user_id
      ORDER BY CASE WHEN s.status='submitted' THEN 0 WHEN s.status='in_review' THEN 1 ELSE 2 END, s.submitted_at DESC
      LIMIT 300
    `);
    return res.json({submissions:rows});
  }
  const id = String(req.body?.submission_id || '');
  const status = String(req.body?.status || '');
  const notes = String(req.body?.reviewer_notes || '').trim().slice(0,3000);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({error:'A valid submission is required.'});
  if (!statuses.has(status)) return res.status(400).json({error:'Choose a valid review status.'});
  const { rows } = await db.query(
    'UPDATE practice_submissions SET status=$2,reviewer_notes=$3,reviewed_by=$4,reviewed_at=now() WHERE id=$1 RETURNING id,status,reviewed_at',
    [id,status,notes,String(req.member?.handle || req.member?.id || 'admin')]
  );
  if (!rows.length) return res.status(404).json({error:'Submission not found.'});
  await db.query(
    'INSERT INTO admin_audit_logs(actor_handle,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',
    [String(req.member?.handle || req.member?.id || 'admin'),'review_practice_submission','practice_submission',id,JSON.stringify({status})]
  );
  return res.json({submission:rows[0],message:'Practice project review saved.'});
}