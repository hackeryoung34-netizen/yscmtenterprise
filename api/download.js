function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}
module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "Method not allowed" }); }
  const root = (process.env.SUPABASE_URL || "").replace(/\/$/, ""), anonKey = process.env.SUPABASE_ANON_KEY;
  if (!root || !anonKey) return send(res, 503, { error: "Secure downloads are not configured yet." });
  const authorization = req.headers.authorization || "", accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const orderId = req.body && typeof req.body.order_id === "string" ? req.body.order_id : "";
  if (!accessToken || !/^[0-9a-f-]{36}$/i.test(orderId)) return send(res, 401, { error: "Sign in and provide a valid order ID." });
  const headers = { apikey: anonKey, Authorization: "Bearer " + accessToken };
  try {
    const userResponse = await fetch(root + "/auth/v1/user", { headers });
    if (!userResponse.ok) return send(res, 401, { error: "Your session is invalid or expired." });
    const user = await userResponse.json();
    const orderUrl = new URL(root + "/rest/v1/store_orders");
    orderUrl.searchParams.set("select", "id,product_id,purchase_type,status");
    orderUrl.searchParams.set("id", "eq." + orderId);
    orderUrl.searchParams.set("user_id", "eq." + user.id);
    orderUrl.searchParams.set("limit", "1");
    const orderResponse = await fetch(orderUrl, { headers });
    if (!orderResponse.ok) return send(res, 502, { error: "Unable to verify the order." });
    const orders = await orderResponse.json(), order = orders[0];
    if (!order || order.status !== "paid" || order.purchase_type !== "source_code") return send(res, 403, { error: "This order does not have a paid source-code download entitlement." });
    const productUrl = new URL(root + "/rest/v1/store_products");
    productUrl.searchParams.set("select", "artifact_path");
    productUrl.searchParams.set("id", "eq." + order.product_id);
    productUrl.searchParams.set("limit", "1");
    const productResponse = await fetch(productUrl, { headers });
    if (!productResponse.ok) return send(res, 502, { error: "Unable to locate the purchased file." });
    const products = await productResponse.json(), path = products[0] && products[0].artifact_path;
    if (!path || path.startsWith("/") || path.split("/").includes("..")) return send(res, 404, { error: "The purchased file is not available." });
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const signedResponse = await fetch(root + "/storage/v1/object/sign/template-archives/" + encodedPath, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 60 })
    });
    if (signedResponse.status === 401 || signedResponse.status === 403) return send(res, 403, { error: "This account is not authorised to download that archive." });
    if (!signedResponse.ok) return send(res, 502, { error: "Unable to create a secure download link." });
    const signed = await signedResponse.json(), signedPath = signed.signedURL || signed.signedUrl;
    if (!signedPath) return send(res, 502, { error: "The storage service returned no download link." });
    const downloadUrl = signedPath.startsWith("http") ? signedPath : root + "/storage/v1" + (signedPath.startsWith("/") ? "" : "/") + signedPath;
    return send(res, 200, { download_url: downloadUrl, expires_in_seconds: 60 });
  } catch { return send(res, 502, { error: "Secure download service is temporarily unavailable." }); }
};