const { getRevenueSql } = require("./revenue-db");

function hasPermission(permissions, permission) {
  return !!permissions && (permissions["*"] === true || permissions[permission] === true);
}

async function requireCentralAdmin(req, permission) {
  const root = (process.env.SUPABASE_URL || "").replace(/\\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!root || !anonKey || !token) {
    return { error: "Administrator sign-in is required.", status: 401 };
  }

  try {
    const response = await fetch(root + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: "Bearer " + token }
    });
    if (!response.ok) return { error: "Your session is invalid or expired.", status: 401 };
    const user = await response.json();
    const sql = getRevenueSql();
    const rows = await sql`select role,is_active,permissions from public.central_admin_roles where user_id=${user.id}::uuid limit 1`;
    const row = rows[0];
    if (!row || !row.is_active) {
      return { error: "Central administrator access is not enabled for this account.", status: 403 };
    }
    const permissions = row.permissions && typeof row.permissions === "object" ? row.permissions : {};
    if (!(Array.isArray(permission) ? permission.some(item => hasPermission(permissions, item)) : hasPermission(permissions, permission))) {
      return { error: "You do not have permission to perform this action.", status: 403 };
    }
    return { user, role: row.role, permissions, sql };
  } catch (error) {
    console.error("[central admin authorization]", error && error.message ? error.message : "Authorization failed");
    return { error: "Administrator authorization is temporarily unavailable.", status: 503 };
  }
}

module.exports = { requireCentralAdmin, hasPermission };
