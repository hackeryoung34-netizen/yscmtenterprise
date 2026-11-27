import { db } from "hatchable";

export const access = "user";
export const methods = ["GET", "PATCH"];

export default async function (req, res) {
  const userId = String(req.user.id);
  if (req.method === "GET") {
    const { rows } = await db.query(
      `SELECT n.id,n.notification_type,n.post_id,n.comment_id,n.entity_id,n.is_read,n.created_at,
        p.display_name,p.username,p.avatar_url
       FROM community_notifications n
       JOIN community_profiles p ON p.user_id=n.actor_id
       WHERE n.user_id=$1
       ORDER BY n.created_at DESC LIMIT 40`,
      [userId]
    );
    const unread = rows.filter(row => !row.is_read).length;
    return res.json({ notifications: rows, unread_count: unread });
  }
  const id = req.body?.id;
  if (id === "all") {
    await db.query("UPDATE community_notifications SET is_read=true WHERE user_id=$1 AND is_read=false", [userId]);
  } else if (/^\d+$/.test(String(id || ""))) {
    await db.query("UPDATE community_notifications SET is_read=true WHERE user_id=$1 AND id=$2", [userId, Number(id)]);
  } else {
    return res.status(400).json({ error: "Choose a notification to mark as read." });
  }
  return res.json({ ok: true });
}