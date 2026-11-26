import { db } from "hatchable";

export const access = "user";
export const methods = ["GET"];

export default async function (req, res) {
  const userId = String(req.user.id);
  const q = typeof req.query?.q === "string" ? req.query.q.trim().slice(0, 60) : "";
  const { rows } = await db.query(
    `SELECT p.user_id,p.display_name,p.username,p.role,p.country,p.field,p.bio,p.avatar_url,
      (SELECT count(*)::int FROM community_follows f WHERE f.following_id=p.user_id) AS followers_count,
      EXISTS(SELECT 1 FROM community_follows mine WHERE mine.follower_id=$1 AND mine.following_id=p.user_id) AS viewer_follows
     FROM community_profiles p
     WHERE p.user_id<>$1 AND p.profile_visibility='public'
       AND NOT EXISTS(SELECT 1 FROM community_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$1))
       AND ($2::text='' OR p.display_name ILIKE '%'||$2||'%' OR p.username ILIKE '%'||$2||'%' OR p.field ILIKE '%'||$2||'%')
     ORDER BY followers_count DESC,p.created_at DESC LIMIT 30`,
    [userId, q]
  );
  return res.json({ members: rows });
}