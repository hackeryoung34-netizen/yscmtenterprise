function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Method not allowed" });
  }

  const baseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    return send(res, 503, { error: "Store catalogue is not configured yet." });
  }

  try {
    const upstream = await fetch(
      `${baseUrl.replace(/\/$/, "")}/rest/v1/store_products?select=id,slug,name,category,summary,description,screenshot_urls,demo_url,technologies,license_type,version,download_price_ngn,installation_price_ngn&status=eq.published&order=created_at.desc`,
      { headers: { apikey: anonKey } }
    );
    if (!upstream.ok) {
      return send(res, 502, { error: "Catalogue service is temporarily unavailable." });
    }
    const products = await upstream.json();
    return send(res, 200, { products });
  } catch {
    return send(res, 502, { error: "Catalogue service is temporarily unavailable." });
  }
};
