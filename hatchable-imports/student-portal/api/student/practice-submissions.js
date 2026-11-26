import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET','POST'];
const labs = new Set(['computer-intermediate','cybersecurity-intermediate','python-intermediate','web-intermediate','computer-advanced','cybersecurity-advanced','python-advanced','web-advanced']);
export default async function(req,res) {
  const userId = req.user.id;
  if (req.method === 'GET') {
    const { rows } = await db.query(
      'SELECT id,lab_key,title,submission_text,project_url,status,reviewer_notes,submitted_at,reviewed_at FROM practice_submissions WHERE user_id=$1 ORDER BY submitted_at DESC LIMIT 100',
      [userId]
    );
    return res.json({ submissions: rows });
  }
  const labKey = String(req.body?.lab_key || '');
  const title = String(req.body?.title || '').trim().slice(0,160);
  const submissionText = String(req.body?.submission_text || '').trim().slice(0,8000);
  const projectUrl = String(req.body?.project_url || '').trim().slice(0,500);
  if (!labs.has(labKey)) return res.status(400).json({error:'Choose a valid Practice Lab.'});
  if (title.length < 3) return res.status(400).json({error:'Project title must be at least 3 characters.'});
  if (!submissionText && !projectUrl) return res.status(400).json({error:'Add project notes or a project link.'});
  if (projectUrl) {
    try { const u = new URL(projectUrl); if (u.protocol !== 'https:') throw new Error(); }
    catch { return res.status(400).json({error:'Project links must be valid HTTPS URLs.'}); }
  }
  const { rows } = await db.query(
    'INSERT INTO practice_submissions(user_id,lab_key,title,submission_text,project_url) VALUES($1,$2,$3,$4,$5) RETURNING id,lab_key,title,status,submitted_at',
    [userId,labKey,title,submissionText,projectUrl]
  );
  return res.status(201).json({submission:rows[0],message:'Your Practice Lab project has been submitted for review.'});
}