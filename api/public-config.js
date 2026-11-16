function send(res, status, body) { res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body)); }
module.exports = function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return send(res, 405, { error: "Method not allowed" }); }
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return send(res, 503, { error: "Store account service is not configured yet." });
  res.setHeader("Cache-Control", "no-store");
  return send(res, 200, { supabaseUrl: url, supabaseAnonKey: key });
};
