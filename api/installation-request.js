function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}
module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "Method not allowed" }); }
  const baseUrl = process.env.SUPABASE_URL, anonKey = process.env.SUPABASE_ANON_KEY, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !anonKey || !serviceKey) return send(res, 503, { error: "Installation service is not configured yet." });
  const authorization = req.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const requirements = typeof body.requirements === "string" ? body.requirements.trim() : "";
  if (!accessToken || !/^[0-9a-f-]{36}$/i.test(orderId) || requirements.length > 5000) return send(res, 400, { error: "Sign in and provide a valid installation order and requirements (maximum 5,000 characters)." });
  const root = baseUrl.replace(/\/$/, "");
  const adminHeaders = { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" };
  try {
    const userResponse = await fetch(root + "/auth/v1/user", { headers: { apikey: anonKey, Authorization: "Bearer " + accessToken } });
    if (!userResponse.ok) return send(res, 401, { error: "Your session is invalid or expired." });
    const user = await userResponse.json();
    const orderUrl = new URL(root + "/rest/v1/store_orders");
    orderUrl.searchParams.set("select", "id,user_id,purchase_type,status");
    orderUrl.searchParams.set("id", "eq." + orderId);
    orderUrl.searchParams.set("user_id", "eq." + user.id);
    orderUrl.searchParams.set("limit", "1");
    const orderResponse = await fetch(orderUrl, { headers: adminHeaders });
    if (!orderResponse.ok) return send(res, 502, { error: "Unable to verify the installation order." });
    const orders = await orderResponse.json(), order = orders[0];
    if (!order || order.status !== "paid" || order.purchase_type !== "installation") return send(res, 403, { error: "A paid installation order is required before requesting setup." });
    const existingUrl = new URL(root + "/rest/v1/store_installations");
    existingUrl.searchParams.set("select", "id,status");
    existingUrl.searchParams.set("order_id", "eq." + order.id);
    existingUrl.searchParams.set("limit", "1");
    const existingResponse = await fetch(existingUrl, { headers: adminHeaders });
    if (!existingResponse.ok) return send(res, 502, { error: "Unable to check the installation request." });
    const existing = await existingResponse.json();
    if (existing[0]) return send(res, 200, { installation_id: existing[0].id, status: existing[0].status, message: "An installation request already exists for this order." });
    const createResponse = await fetch(root + "/rest/v1/store_installations", { method: "POST", headers: { ...adminHeaders, Prefer: "return=representation" }, body: JSON.stringify({ order_id: order.id, user_id: user.id, requirements }) });
    if (!createResponse.ok) return send(res, 502, { error: "Unable to create the installation request." });
    const created = await createResponse.json();
    if (!created[0]) return send(res, 502, { error: "The installation service returned no request record." });
    return send(res, 201, { installation_id: created[0].id, status: created[0].status, message: "Installation request received." });
  } catch { return send(res, 502, { error: "Installation service is temporarily unavailable." }); }
};
