import { db, events } from "hatchable";

export const access = "user";
export const methods = ["GET", "POST", "DELETE"];

const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validPostId = value => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

export default async function (req, res) {
  const userId = String(req.user.id);

  if (req.method === "GET") {
    const postId = req.query?.post_id;
    if (!validPostId(postId)) return res.status(400).json({ error: "A valid post ID is required." });
    const { rows: visible } = await db.query(
      `SELECT p.id FROM community_posts p JOIN community_profiles pr ON pr.user_id=p.user_id
       WHERE p.id=$1::uuid AND p.status='published'
         AND (p.user_id=$2 OR pr.profile_visibility='public')
         AND NOT EXISTS(SELECT 1 FROM community_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$2))
         AND (p.user_id=$2 OR p.visibility='public' OR
           (p.visibility='followers' AND EXISTS(
             SELECT 1 FROM community_follows f WHERE f.follower_id=$2 AND f.following_id=p.user_id
           )))`,
      [postId, userId]
    );
    if (!visible.length) return res.status(404).json({ error: "Post not found." });
    const { rows } = await db.query(
      `SELECT c.id,c.body,c.created_at,c.edited_at,c.user_id,p.display_name,p.username,p.avatar_url
       FROM community_post_comments c
       JOIN community_profiles p ON p.user_id=c.user_id
       WHERE c.post_id=$1::uuid AND c.status='published'
         AND NOT EXISTS(SELECT 1 FROM community_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=c.user_id) OR (b.blocker_id=c.user_id AND b.blocked_id=$2))
       ORDER BY c.created_at ASC LIMIT 100`,
      [postId, userId]
    );
    return res.json({ comments: rows });
  }

  const b = req.body || {};
  const action = clean(b.action, 20);

  if (req.method === "POST") {
    if (action === "like") {
      if (!validPostId(b.post_id)) return res.status(400).json({ error: "A valid post ID is required." });
      const { rows: post } = await db.query(
        `SELECT p.user_id FROM community_posts p JOIN community_profiles pr ON pr.user_id=p.user_id
         WHERE p.id=$1::uuid AND p.status='published'
           AND (p.user_id=$2 OR pr.profile_visibility='public')
           AND NOT EXISTS(SELECT 1 FROM community_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$2))
           AND (p.user_id=$2 OR p.visibility='public' OR
             (p.visibility='followers' AND EXISTS(
               SELECT 1 FROM community_follows f WHERE f.follower_id=$2 AND f.following_id=p.user_id
             )))`,
        [b.post_id, userId]
      );
      if (!post.length) return res.status(404).json({ error: "Post not found." });
      const { rows: inserted } = await db.query(
        "INSERT INTO community_post_likes(post_id,user_id) VALUES($1::uuid,$2) ON CONFLICT DO NOTHING RETURNING post_id",
        [b.post_id, userId]
      );
      if (inserted.length && post[0].user_id !== userId) {
        await db.query(
          "INSERT INTO community_notifications(user_id,actor_id,notification_type,post_id) VALUES($1,$2,'like',$3::uuid)",
          [post[0].user_id, userId, b.post_id]
        );
        await events.publish("user:"+post[0].user_id,"notification",{type:"like",post_id:b.post_id});
      }
      return res.json({ ok: true, liked: true });
    }

    if (action === "comment") {
      if (!validPostId(b.post_id)) return res.status(400).json({ error: "A valid post ID is required." });
      const body = clean(b.body, 1200);
      if (!body) return res.status(400).json({ error: "Write a comment first." });
      const { rows: post } = await db.query(
        `SELECT p.user_id FROM community_posts p JOIN community_profiles pr ON pr.user_id=p.user_id
         WHERE p.id=$1::uuid AND p.status='published'
           AND (p.user_id=$2 OR pr.profile_visibility='public')
           AND NOT EXISTS(SELECT 1 FROM community_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$2))
           AND (p.user_id=$2 OR p.visibility='public' OR
             (p.visibility='followers' AND EXISTS(
               SELECT 1 FROM community_follows f WHERE f.follower_id=$2 AND f.following_id=p.user_id
             )))`,
        [b.post_id, userId]
      );
      if (!post.length) return res.status(404).json({ error: "Post not found." });
      const { rows } = await db.query(
        "INSERT INTO community_post_comments(post_id,user_id,body) VALUES($1::uuid,$2,$3) RETURNING id,post_id,body,created_at",
        [b.post_id, userId, body]
      );
      if (post[0].user_id !== userId) {
        await db.query(
          "INSERT INTO community_notifications(user_id,actor_id,notification_type,post_id,comment_id) VALUES($1,$2,'comment',$3::uuid,$4)",
          [post[0].user_id, userId, b.post_id, rows[0].id]
        );
        await events.publish("user:"+post[0].user_id,"notification",{type:"comment",post_id:b.post_id});
      }
      return res.status(201).json({ ok: true, comment: rows[0] });
    }

    if (action === "follow") {
      const target = clean(b.user_id, 128);
      if (!target || target === userId) return res.status(400).json({ error: "Choose another member to follow." });
      const { rows: profile } = await db.query(
        "SELECT user_id FROM community_profiles WHERE user_id=$1 AND profile_visibility='public' AND NOT EXISTS(SELECT 1 FROM community_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=$1) OR (b.blocker_id=$1 AND b.blocked_id=$2))",
        [target,userId]
      );
      if (!profile.length) return res.status(404).json({ error: "Member not found." });
      const { rows: inserted } = await db.query(
        "INSERT INTO community_follows(follower_id,following_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING following_id",
        [userId, target]
      );
      if (inserted.length) {
        await db.query(
          "INSERT INTO community_notifications(user_id,actor_id,notification_type) VALUES($1,$2,'follow')",
          [target, userId]
        );
        await events.publish("user:"+target,"notification",{type:"follow"});
      }
      return res.json({ ok: true, following: true });
    }

    if (action === "block") {
      const target=clean(b.user_id,128);
      if(!target||target===userId)return res.status(400).json({error:"Choose another member to block."});
      const profile=await db.query("SELECT user_id FROM community_profiles WHERE user_id=$1",[target]);
      if(!profile.rows.length)return res.status(404).json({error:"Member not found."});
      await db.query("INSERT INTO community_blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[userId,target]);
      await db.query("DELETE FROM community_follows WHERE (follower_id=$1 AND following_id=$2) OR (follower_id=$2 AND following_id=$1)",[userId,target]);
      return res.json({ok:true,blocked:true});
    }

    if (action === "report") {
      const type = clean(b.target_type, 12);
      const reason = clean(b.reason, 500);
      if (!["post","comment","profile"].includes(type) || reason.length < 5) {
        return res.status(400).json({ error: "Choose what to report and provide a reason of at least five characters." });
      }
      let postId = null, commentId = null, targetUser = null;
      if (type === "post" && validPostId(b.target_id)) postId = b.target_id;
      else if (type === "comment" && /^\d+$/.test(String(b.target_id || ""))) commentId = Number(b.target_id);
      else if (type === "profile") targetUser = clean(b.target_id, 128);
      else return res.status(400).json({ error: "The report target is invalid." });
      await db.query(
        "INSERT INTO community_reports(reporter_id,target_type,target_post_id,target_comment_id,target_user_id,reason) VALUES($1,$2,$3::uuid,$4,$5,$6)",
        [userId, type, postId, commentId, targetUser, reason]
      );
      return res.status(201).json({ ok: true, message: "Thank you. Your report has been sent to the moderation team." });
    }

    return res.status(400).json({ error: "Unknown community action." });
  }

  if (action === "unlike" && validPostId(b.post_id)) {
    await db.query("DELETE FROM community_post_likes WHERE post_id=$1::uuid AND user_id=$2", [b.post_id, userId]);
    return res.json({ ok: true, liked: false });
  }
  if (action === "unblock") {
    const target=clean(b.user_id,128);
    await db.query("DELETE FROM community_blocks WHERE blocker_id=$1 AND blocked_id=$2",[userId,target]);
    return res.json({ok:true,blocked:false});
  }
  if (action === "unfollow") {
    const target = clean(b.user_id, 128);
    await db.query("DELETE FROM community_follows WHERE follower_id=$1 AND following_id=$2", [userId, target]);
    return res.json({ ok: true, following: false });
  }
  if (action === "delete_comment" && /^\d+$/.test(String(b.comment_id || ""))) {
    const { rows } = await db.query(
      "UPDATE community_post_comments SET status='removed' WHERE id=$1 AND user_id=$2 AND status='published' RETURNING id",
      [Number(b.comment_id), userId]
    );
    if (!rows.length) return res.status(404).json({ error: "Comment not found or you cannot remove it." });
    return res.json({ ok: true });
  }
  return res.status(400).json({ error: "Invalid interaction request." });
}