import { db } from "hatchable";

export const access = "user";
export const methods = ["GET", "POST"];

const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validAvatar = value => !value || (/^https:\/\//i.test(value) && value.length <= 1000);

export default async function (req, res) {
  const user = req.user;
  if (req.method === "GET") {
    const { rows } = await db.query(
      "SELECT display_name, role, country, field, bio, username, avatar_url, profile_visibility FROM community_profiles WHERE user_id=$1",
      [String(user.id)]
    );
    return res.json({ profile: rows[0] || null, email: user.email });
  }

  const b = req.body || {};
  const name = clean(b.display_name, 80);
  const role = clean(b.role, 20);
  const country = clean(b.country, 80);
  const field = clean(b.field, 100);
  const bio = clean(b.bio, 500);
  const username = clean(b.username, 24).toLowerCase();
  const avatar = clean(b.avatar_url, 1000);
  const visibility = b.profile_visibility === "private" ? "private" : "public";

  if (name.length < 2 || !["student", "teacher", "mentor"].includes(role) || country.length < 2) {
    return res.status(400).json({ error: "Please provide your name, role and country." });
  }
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3–24 characters using letters, numbers or underscores." });
  }
  if (!validAvatar(avatar)) return res.status(400).json({ error: "Avatar URL must use HTTPS." });

  try {
    const { rows } = await db.query(
      `INSERT INTO community_profiles(user_id,email,display_name,role,country,field,bio,username,avatar_url,profile_visibility)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,display_name=EXCLUDED.display_name,
       role=EXCLUDED.role,country=EXCLUDED.country,field=EXCLUDED.field,bio=EXCLUDED.bio,
       username=EXCLUDED.username,avatar_url=EXCLUDED.avatar_url,
       profile_visibility=EXCLUDED.profile_visibility,updated_at=now()
       RETURNING display_name,role,country,field,bio,username,avatar_url,profile_visibility`,
      [String(user.id), String(user.email || "").toLowerCase(), name, role, country, field, bio, username, avatar, visibility]
    );
    return res.json({ ok: true, profile: rows[0] });
  } catch (error) {
    if (error?.code === "23505") return res.status(409).json({ error: "That username is already taken. Choose another one." });
    throw error;
  }
}