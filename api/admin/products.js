function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}
const editable = ["slug","name","category","summary","description","screenshot_urls","demo_url","technologies","license_type","version","download_price_ngn","installation_price_ngn","artifact_path","status"];
const categories = new Set(["Business Websites","E-commerce","Portfolio","School & LMS","Blog & News","Admin Dashboard"]);
module.exports = async function handler(req, res) {
  if (!["GET","POST","PATCH"].includes(req.method)) { res.setHeader("Allow", "GET, POST, PATCH"); return send(res, 405, { error: "Method not allowed" }); }
  const baseUrl = process.env.SUPABASE_URL, anonKey = process.env.SUPABASE_ANON_KEY, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !anonKey || !serviceKey) return send(res, 503, { error: "Store administration is not configured yet." });
  const authorization = req.headers.authorization || "", accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) return send(res, 401, { error: "Administrator sign-in is required." });
  const root = baseUrl.replace(/\/$/, ""), headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" };
  try {
    const authResponse = await fetch(root + "/auth/v1/user", { headers: { apikey: anonKey, Authorization: "Bearer " + accessToken } });
    if (!authResponse.ok) return send(res, 401, { error: "Your session is invalid or expired." });
    const user = await authResponse.json();
    if (!user.app_metadata || user.app_metadata.role !== "store_admin") return send(res, 403, { error: "Store administrator permission is required." });
    if (req.method === "GET") {
      const url = new URL(root + "/rest/v1/store_products");
      url.searchParams.set("select", "*"); url.searchParams.set("order", "created_at.desc");
      const response = await fetch(url, { headers });
      if (!response.ok) return send(res, 502, { error: "Unable to load products." });
      return send(res, 200, { products: await response.json() });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {}, payload = {};
    for (const key of editable) if (Object.prototype.hasOwnProperty.call(body, key)) payload[key] = body[key];
    if (!Object.keys(payload).length) return send(res, 400, { error: "No editable product fields were supplied." });
    if (payload.category && !categories.has(payload.category)) return send(res, 400, { error: "Invalid product category." });
    if (payload.status && !["draft","published","archived"].includes(payload.status)) return send(res, 400, { error: "Invalid product status." });
    if (payload.name !== undefined && (typeof payload.name !== "string" || !payload.name.trim())) return send(res, 400, { error: "Product name is required." });
    if (payload.slug !== undefined && (typeof payload.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug))) return send(res, 400, { error: "Slug must use lowercase letters, numbers and hyphens." });
    for (const field of ["download_price_ngn","installation_price_ngn"]) if (payload[field] !== undefined && payload[field] !== null && (!Number.isSafeInteger(payload[field]) || payload[field] < 0)) return send(res, 400, { error: field + " must be a non-negative whole number or null." });
    for (const field of ["screenshot_urls","technologies"]) if (payload[field] !== undefined && (!Array.isArray(payload[field]) || payload[field].some(item => typeof item !== "string"))) return send(res, 400, { error: field + " must be an array of strings." });
    let url, method;
    if (req.method === "POST") {
      for (const field of ["slug","name","category"]) if (!payload[field]) return send(res, 400, { error: field + " is required for a new product." });
      url = root + "/rest/v1/store_products"; method = "POST";
    } else {
      const id = typeof body.id === "string" ? body.id : "";
      if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: "A valid product ID is required for updates." });
      url = new URL(root + "/rest/v1/store_products"); url.searchParams.set("id", "eq." + id); method = "PATCH";
    }
    const response = await fetch(url, { method, headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(payload) });
    if (!response.ok) return send(res, 502, { error: "Product could not be saved. Check required fields and database configuration." });
    const saved = await response.json();
    if (!saved[0]) return send(res, 404, { error: "No product was changed." });
    await fetch(root + "/rest/v1/store_audit_logs", { method: "POST", headers, body: JSON.stringify({ actor_user_id: user.id, action: req.method === "POST" ? "product_created" : "product_updated", entity_type: "store_product", entity_id: saved[0].id, details: { status: saved[0].status, slug: saved[0].slug } }) }).catch(() => {});
    return send(res, req.method === "POST" ? 201 : 200, { product: saved[0] });
  } catch { return send(res, 502, { error: "Store administration is temporarily unavailable." }); }
};
