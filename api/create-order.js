function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed" });
  }

  const baseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !anonKey || !serviceKey) {
    return send(res, 503, { error: "Order service is not configured yet." });
  }

  const authorization = req.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const productId = req.body && typeof req.body.product_id === "string" ? req.body.product_id : "";
  const purchaseType = req.body && req.body.purchase_type;
  if (!accessToken || !/^[0-9a-f-]{36}$/i.test(productId) || !["source_code", "installation"].includes(purchaseType)) {
    return send(res, 400, { error: "Sign in and provide a valid product and purchase type." });
  }

  const root = baseUrl.replace(/\/$/, "");
  const adminHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json"
  };

  try {
    const userResponse = await fetch(`${root}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` }
    });
    if (!userResponse.ok) return send(res, 401, { error: "Your session is invalid or expired." });
    const user = await userResponse.json();

    const productUrl = new URL(`${root}/rest/v1/store_products`);
    productUrl.searchParams.set("select", "id,download_price_ngn,installation_price_ngn,status");
    productUrl.searchParams.set("id", `eq.${productId}`);
    productUrl.searchParams.set("status", "eq.published");
    productUrl.searchParams.set("limit", "1");
    const productResponse = await fetch(productUrl, { headers: adminHeaders });
    if (!productResponse.ok) return send(res, 502, { error: "Unable to verify this product." });
    const products = await productResponse.json();
    const product = products[0];
    if (!product) return send(res, 404, { error: "This template is not available for purchase." });

    const amount = purchaseType === "source_code" ? product.download_price_ngn : product.installation_price_ngn;
    if (!Number.isSafeInteger(amount) || amount < 0 || (purchaseType === "installation" && amount === null)) {
      return send(res, 409, { error: "This purchase option is not available yet." });
    }

    const orderResponse = await fetch(`${root}/rest/v1/store_orders`, {
      method: "POST",
      headers: { ...adminHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: user.id,
        product_id: product.id,
        purchase_type: purchaseType,
        amount_ngn: amount,
        currency: "NGN",
        status: "pending"
      })
    });
    if (!orderResponse.ok) return send(res, 502, { error: "Unable to create your pending order." });
    const orders = await orderResponse.json();
    if (!orders[0]) return send(res, 502, { error: "The order service returned no order record." });
    return send(res, 201, {
      order_id: orders[0].id,
      amount_ngn: amount,
      currency: "NGN",
      status: "pending",
      message: "Order created. Payment must be completed and verified before access is granted."
    });
  } catch {
    return send(res, 502, { error: "Order service is temporarily unavailable." });
  }
};
