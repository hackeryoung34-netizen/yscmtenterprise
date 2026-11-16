function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}
module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "Method not allowed" }); }
  const root = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!root || !anonKey) return send(res, 503, { error: "Order service is not configured yet." });
  const authorization = req.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const productId = typeof body.product_id === "string" ? body.product_id : "";
  const purchaseType = body.purchase_type;
  if (!accessToken || !/^[0-9a-f-]{36}$/i.test(productId) || !["source_code", "installation"].includes(purchaseType)) return send(res, 400, { error: "Sign in and provide a valid product and purchase type." });
  const headers = { apikey: anonKey, Authorization: "Bearer " + accessToken, "Content-Type": "application/json" };
  try {
    const userResponse = await fetch(root + "/auth/v1/user", { headers });
    if (!userResponse.ok) return send(res, 401, { error: "Your session is invalid or expired." });
    const user = await userResponse.json();
    const productUrl = new URL(root + "/rest/v1/store_products");
    productUrl.searchParams.set("select", "id,download_price_ngn,installation_price_ngn");
    productUrl.searchParams.set("id", "eq." + productId);
    productUrl.searchParams.set("status", "eq.published");
    productUrl.searchParams.set("limit", "1");
    const productResponse = await fetch(productUrl, { headers });
    if (!productResponse.ok) return send(res, 502, { error: "Unable to verify this product." });
    const products = await productResponse.json(), product = products[0];
    if (!product) return send(res, 404, { error: "This template is not available for purchase." });
    const amount = purchaseType === "source_code" ? product.download_price_ngn : product.installation_price_ngn;
    if (!Number.isSafeInteger(amount) || amount < 0) return send(res, 409, { error: "This purchase option is not available yet." });
    const orderResponse = await fetch(root + "/rest/v1/store_orders", {
      method: "POST", headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ user_id: user.id, product_id: product.id, purchase_type: purchaseType, amount_ngn: amount, currency: "NGN", status: "pending" })
    });
    if (orderResponse.status === 401 || orderResponse.status === 403) return send(res, 403, { error: "Your account cannot create this order. Please sign in again." });
    if (!orderResponse.ok) return send(res, 502, { error: "Unable to create your pending order." });
    const orders = await orderResponse.json();
    if (!orders[0]) return send(res, 502, { error: "The order service returned no order record." });
    return send(res, 201, { order_id: orders[0].id, amount_ngn: amount, currency: "NGN", status: "pending", message: "Order created. Payment must be completed and verified before access is granted." });
  } catch { return send(res, 502, { error: "Order service is temporarily unavailable." }); }
};