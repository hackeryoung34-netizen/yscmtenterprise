import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET", "PATCH"];

export default async function (req, res) {
  if (req.method === "GET") {
    const { rows } = await db.query(
      `SELECT r.id,r.target_type,r.target_post_id,r.target_comment_id,r.target_user_id,
        r.reason,r.status,r.created_at,p.display_name AS reporter_name
       FROM community_reports r
       LEFT JOIN community_profiles p ON p.user_id=r.reporter_id
       WHERE r.status='open' ORDER BY r.created_at ASC LIMIT 100`
    );
    return res.json({ reports: rows });
  }

  const id = Number(req.body?.id);
  const status = req.body?.status;
  const action = req.body?.action || "none";
  if (!Number.isSafeInteger(id) || id < 1 || !["reviewed","dismissed"].includes(status) ||
      !["none","hide_post","remove_post","remove_comment","make_profile_private"].includes(action)) {
    return res.status(400).json({ error: "Choose a valid report and moderation decision." });
  }
  const report = await db.query("SELECT target_type,target_post_id,target_comment_id,target_user_id FROM community_reports WHERE id=$1 AND status='open'",[id]);
  if (!report.rows.length) return res.status(404).json({ error: "Open report not found." });
  const target = report.rows[0];
  if (action==="hide_post" || action==="remove_post") {
    if (target.target_type!=="post") return res.status(400).json({error:"This action only applies to a post."});
    await db.query("UPDATE community_posts SET status=$1 WHERE id=$2::uuid",[action==="hide_post"?"hidden":"removed",target.target_post_id]);
  } else if (action==="remove_comment") {
    if (target.target_type!=="comment") return res.status(400).json({error:"This action only applies to a comment."});
    await db.query("UPDATE community_post_comments SET status='removed' WHERE id=$1",[target.target_comment_id]);
  } else if (action==="make_profile_private") {
    if (target.target_type!=="profile") return res.status(400).json({error:"This action only applies to a profile."});
    await db.query("UPDATE community_profiles SET profile_visibility='private',updated_at=now() WHERE user_id=$1",[target.target_user_id]);
  }
  const { rows } = await db.query(
    "UPDATE community_reports SET status=$1,reviewed_by=$2,reviewed_at=now() WHERE id=$3 AND status='open' RETURNING id,status,target_type,target_post_id,target_comment_id",
    [status, String(req.member.id), id]
  );
  if (!rows.length) return res.status(404).json({ error: "Open report not found." });
  return res.json({ ok: true, report: rows[0] });
}