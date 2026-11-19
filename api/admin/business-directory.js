const { getRevenueSql } = require("../_lib/revenue-db");

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.send(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (!["GET", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, PATCH");
    return send(res, 405, { error: "Method not allowed" });
  }
  const root = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!root || !anonKey) return send(res, 503, { error: "Administrator authentication is not configured." });
  if (!token) return send(res, 401, { error: "Administrator sign-in is required." });

  try {
    const auth = await fetch(root + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: "Bearer " + token }
    });
    if (!auth.ok) return send(res, 401, { error: "Your session is invalid or expired." });
    const user = await auth.json();
    if (!user.app_metadata || user.app_metadata.role !== "store_admin") {
      return send(res, 403, { error: "Administrator permission is required." });
    }
    const sql = getRevenueSql();
    if (req.method === "GET") {
      const listings = await sql`
        select id, business_name, slug, category, state, city, phone, email,
          status, is_featured, featured_until, created_at, admin_notes
        from public.business_directory_listings
        order by created_at desc limit 200
      `;
      return send(res, 200, { listings });
    }

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const id = typeof body.id === "string" ? body.id : "";
    const status = typeof body.status === "string" ? body.status : "";
    const notes = typeof body.admin_notes === "string" ? body.admin_notes.trim().slice(0, 2000) : null;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: "A valid listing ID is required." });
    if (!["approved", "rejected", "suspended"].includes(status)) return send(res, 400, { error: "Invalid moderation status." });

    const updated = await sql`
      update public.business_directory_listings
      set status = ${status},
          admin_notes = ${notes},
          approved_at = case when ${status} = 'approved' then coalesce(approved_at, now()) else approved_at end
      where id = ${id}::uuid
      returning id, business_name, slug, status, admin_notes, approved_at
    `;
    if (!updated[0]) return send(res, 404, { error: "Listing not found." });
    await sql`
      insert into public.business_directory_audit_logs (listing_id, actor_user_id, action, details)
      values (${id}::uuid, ${user.id}, ${"listing_" + status}, ${JSON.stringify({ status, admin_notes: notes })}::jsonb)
    `;
    return send(res, 200, { listing: updated[0] });
  } catch {
    return send(res, 503, { error: "Business Directory moderation is temporarily unavailable." });
  }
};
