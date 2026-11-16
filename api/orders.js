function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}
module.exports = async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return send(res, 405, { error: "Method not allowed" }); }
  const root = (process.env.SUPABASE_URL || "").replace(/\/$/, ""), anonKey = process.env.SUPABASE_ANON_KEY;
  if (!root || !anonKey) return send(res, 503, { error: "Order history is not configured yet." });
  const authorization = req.headers.authorization || "", accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) return send(res, 401, { error: "Sign in to view your orders." });
  try {
    const authHeaders = { apikey: anonKey, Authorization: "Bearer " + accessToken };
    const userResponse = await fetch(root + "/auth/v1/user", { headers: authHeaders });
    if (!userResponse.ok) return send(res, 401, { error: "Your session is invalid or expired." });
    const user = await userResponse.json();
    const url = new URL(root + "/rest/v1/store_orders");
    url.searchParams.set("select", "id,product_id,purchase_type,amount_ngn,currency,status,created_at,paid_at,store_products(name,slug)");
    url.searchParams.set("user_id", "eq." + user.id);
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "100");
    const response = await fetch(url, { headers: authHeaders });
    if (!response.ok) return send(res, 502, { error: "Unable to load your orders." });
    return send(res, 200, { orders: await response.json() });
  } catch { return send(res, 502, { error: "Order history is temporarily unavailable." }); }
};