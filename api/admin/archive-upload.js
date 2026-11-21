const { requireCentralAdmin } = require("../_lib/central-admin");

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed" });
  }

  const auth = await requireCentralAdmin(req, "templates.manage");
  if (auth.error) return send(res, auth.status, { error: auth.error });

  const root = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!root || !serviceKey) return send(res, 503, { error: "Archive upload is not configured." });

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const version = typeof body.version === "string" ? body.version.trim() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(version)) {
    return send(res, 400, { error: "A valid product slug and version are required." });
  }

  const path = slug + "/" + version.replace(/[^a-zA-Z0-9._-]/g, "-") + ".zip";
  try {
    const signed = await fetch(root + "/storage/v1/object/upload/sign/template-archives/" + path.split("/").map(encodeURIComponent).join("/"), {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
        "x-upsert": "true"
      },
      body: "{}"
    });
    const data = await signed.json().catch(() => ({}));
    if (!signed.ok || typeof data.url !== "string") {
      console.error("[template archive signed upload]", signed.status, data && (data.message || data.error) || "Storage request failed");
      return send(res, 502, { error: "Could not prepare a secure archive upload." });
    }
    const signedUrl = new URL(data.url, root).toString();
    return send(res, 200, { path, signedUrl });
  } catch (error) {
    console.error("[template archive signed upload]", error && error.message ? error.message : "Storage request failed");
    return send(res, 502, { error: "Archive storage is temporarily unavailable." });
  }
};
