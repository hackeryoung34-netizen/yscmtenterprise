import { db, storage, events } from "hatchable";

export const access = "user";
export const methods = ["GET", "POST", "PATCH", "DELETE"];

const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validId = value => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

export default async function (req, res) {
  const userId = String(req.user.id);

  if (req.method === "GET") {
    const scope = req.query?.scope === "following" ? "following" : "all";
    const username = clean(req.query?.username, 24).toLowerCase();
    const { rows } = await db.query(
      `SELECT p.id, p.user_id, p.body, p.visibility, p.created_at, p.edited_at,
        c.display_name, c.username, c.avatar_url, c.role, c.country,
        m.storage_key, m.content_type,
        (SELECT count(*)::int FROM community_post_likes l WHERE l.post_id=p.id) AS likes_count,
        (SELECT count(*)::int FROM community_post_comments cm WHERE cm.post_id=p.id AND cm.status='published') AS comments_count,
        EXISTS(SELECT 1 FROM community_post_likes vl WHERE vl.post_id=p.id AND vl.user_id=$1) AS viewer_liked,
        EXISTS(SELECT 1 FROM community_follows vf WHERE vf.follower_id=$1 AND vf.following_id=p.user_id) AS viewer_follows
      FROM community_posts p
      JOIN community_profiles c ON c.user_id=p.user_id
      LEFT JOIN community_media m ON m.id=p.media_id
      WHERE p.status='published' AND (p.user_id=$1 OR c.profile_visibility='public')
        AND NOT EXISTS(SELECT 1 FROM community_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$1))
        AND (p.user_id=$1 OR p.visibility='public'
          OR (p.visibility='followers' AND EXISTS(
            SELECT 1 FROM community_follows f WHERE f.follower_id=$1 AND f.following_id=p.user_id
          )))
        AND ($2::text='all' OR p.user_id=$1 OR EXISTS(
          SELECT 1 FROM community_follows f WHERE f.follower_id=$1 AND f.following_id=p.user_id
        ))
        AND ($3::text IS NULL OR c.username=$3)
      ORDER BY p.created_at DESC
      LIMIT 40`,
      [userId, scope, username || null]
    );
    const posts = await Promise.all(rows.map(async p => ({...p,media_url:p.storage_key?await storage.url(p.storage_key):null,storage_key:undefined})));
    return res.json({ posts, scope });
  }

  if (req.method === "POST") {
    const body = clean(req.body?.body, 1200);
    const visibility = req.body?.visibility === "followers" ? "followers" : "public";
    const mediaId = req.body?.media_id || null;
    if (!body && !mediaId) return res.status(400).json({ error: "Write something or attach media before publishing." });
    if (mediaId) {
      if (typeof mediaId !== "string" || !/^[0-9a-f-]{36}$/i.test(mediaId)) return res.status(400).json({ error: "Invalid media attachment." });
      const media = await db.query("SELECT id FROM community_media WHERE id=$1::uuid AND user_id=$2", [mediaId, userId]);
      if (!media.rows.length) return res.status(400).json({ error: "Invalid media attachment." });
    }
    const { rows: profile } = await db.query(
      "SELECT user_id FROM community_profiles WHERE user_id=$1",
      [userId]
    );
    if (!profile.length) return res.status(409).json({ error: "Complete your profile before posting." });
    const { rows } = await db.query(
      "INSERT INTO community_posts(user_id,body,visibility,media_id) VALUES($1,$2,$3,$4::uuid) RETURNING id,body,visibility,media_id,created_at",
      [userId, body, visibility, mediaId]
    );
    await events.publish("community","post-created",{post_id:rows[0].id});
    return res.status(201).json({ ok: true, post: rows[0] });
  }

  if (req.method === "PATCH") {
    const id = req.body?.id;
    const body = clean(req.body?.body, 1200);
    if (!validId(id) || !body) return res.status(400).json({ error: "A valid post and message are required." });
    const { rows } = await db.query(
      "UPDATE community_posts SET body=$1,edited_at=now() WHERE id=$2::uuid AND user_id=$3 AND status='published' RETURNING id,body,edited_at",
      [body, id, userId]
    );
    if (!rows.length) return res.status(404).json({ error: "Post not found or you cannot edit it." });
    return res.json({ ok: true, post: rows[0] });
  }

  const id = req.body?.id;
  if (!validId(id)) return res.status(400).json({ error: "A valid post ID is required." });
  const { rows } = await db.query(
    "UPDATE community_posts SET status='removed' WHERE id=$1::uuid AND user_id=$2 AND status='published' RETURNING id",
    [id, userId]
  );
  if (!rows.length) return res.status(404).json({ error: "Post not found or you cannot remove it." });
  return res.json({ ok: true });
}