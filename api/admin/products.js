function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

const editable = ["slug", "name", "category", "summary", "description", "screenshot_urls", "demo_url", "technologies", "license_type", "version", "download_price_ngn", "installation_price_ngn", "artifact_path", "status"];
const categories = new Set(["Business Websites", "E-commerce", "Portfolio", "School & LMS", "Blog & News", "Admin Dashboard"]);
const statuses = new Set(["draft", "published", "archived"]);
const { requireCentralAdmin } = require("../_lib/central-admin");

function validHttpUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function validatePayload(payload) {
  const stringLimits = {
    name: 120,
    slug: 100,
    summary: 300,
    description: 10000,
    license_type: 80,
    version: 40
  };

  for (const [field, max] of Object.entries(stringLimits)) {
    if (payload[field] !== undefined) {
      if (typeof payload[field] !== "string") return field + " must be text.";
      payload[field] = payload[field].trim();
      if (payload[field].length > max) return field + " must be " + max + " characters or fewer.";
      if (["name", "slug"].includes(field) && !payload[field]) return field + " cannot be empty.";
    }
  }

  if (payload.category !== undefined && !categories.has(payload.category)) return "Invalid product category.";
  if (payload.status !== undefined && !statuses.has(payload.status)) return "Invalid product status.";

  if (payload.slug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
    return "Slug must use lowercase letters, numbers and hyphens.";
  }

  for (const field of ["download_price_ngn", "installation_price_ngn"]) {
    if (payload[field] !== undefined && payload[field] !== null &&
        (!Number.isSafeInteger(payload[field]) || payload[field] < 0)) {
      return field + " must be a non-negative whole number" + (field === "installation_price_ngn" ? " or null." : ".");
    }
  }
  if (payload.download_price_ngn === null) return "download_price_ngn cannot be null.";

  for (const field of ["screenshot_urls", "technologies"]) {
    if (payload[field] !== undefined) {
      const values = payload[field];
      const maxItems = field === "screenshot_urls" ? 10 : 30;
      const maxLength = field === "screenshot_urls" ? 2048 : 50;
      if (!Array.isArray(values) || values.length > maxItems ||
          values.some(item => typeof item !== "string" || !item.trim() || item.length > maxLength)) {
        return field + " must contain at most " + maxItems + " valid strings (maximum " + maxLength + " characters each).";
      }
      if (field === "screenshot_urls" && values.some(item => !validHttpUrl(item))) {
        return "Every screenshot URL must use HTTP or HTTPS.";
      }
      payload[field] = values.map(item => item.trim());
    }
  }

  if (payload.demo_url !== undefined && payload.demo_url !== null &&
      (payload.demo_url !== "" && !validHttpUrl(payload.demo_url))) {
    return "demo_url must be a valid HTTP or HTTPS URL.";
  }
  if (payload.demo_url === "") payload.demo_url = null;

  if (payload.artifact_path !== undefined && payload.artifact_path !== null) {
    const path = payload.artifact_path;
    if (typeof path !== "string" || path.length > 512 ||
        path.startsWith("/") || path.includes("..") ||
        !/^[A-Za-z0-9._/-]+$/.test(path) || !path.toLowerCase().endsWith(".zip")) {
      return "artifact_path must be a safe relative path to a ZIP archive.";
    }
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    return send(res, 405, { error: "Method not allowed" });
  }

  const root = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!root || !anonKey || !serviceKey) return send(res, 503, { error: "Store administration is not configured yet." });

  const permission = req.method === "GET" ? "templates.read" : "templates.manage";
  const auth = await requireCentralAdmin(req, permission);
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const user = auth.user;
  const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" };
  try {
    if (req.method === "GET") {
      const url = new URL(root + "/rest/v1/store_products");
      url.searchParams.set("select", "*");
      url.searchParams.set("order", "created_at.desc");
      const response = await fetch(url, { headers });
      if (!response.ok) return send(res, 502, { error: "Unable to load products." });
      return send(res, 200, { products: await response.json() });
    }

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    if (req.method === "POST" && body.action === "archive-upload") {
      const slug = typeof body.slug === "string" ? body.slug.trim() : "";
      const version = typeof body.version === "string" ? body.version.trim() : "";
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(version)) {
        return send(res, 400, { error: "A valid product slug and version are required." });
      }
      const path = slug + "/" + version.replace(/[^a-zA-Z0-9._-]/g, "-") + ".zip";
      const signed = await fetch(root + "/storage/v1/object/upload/sign/template-archives/" + path.split("/").map(encodeURIComponent).join("/"), {
        method: "POST",
        headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json", "x-upsert": "true" },
        body: "{}"
      });
      const signedData = await signed.json().catch(() => ({}));
      if (!signed.ok || typeof signedData.url !== "string") {
        console.error("[template archive signed upload]", signed.status, signedData && (signedData.message || signedData.error) || "Storage request failed");
        return send(res, 502, { error: "Could not prepare a secure archive upload." });
      }
      return send(res, 200, { path, signedUrl: new URL(signedData.url, root).toString() });
    }
    const payload = {};
    for (const key of editable) {
      if (Object.prototype.hasOwnProperty.call(body, key)) payload[key] = body[key];
    }
    if (!Object.keys(payload).length) return send(res, 400, { error: "No editable product fields were supplied." });

    const validationError = validatePayload(payload);
    if (validationError) return send(res, 400, { error: validationError });

    let url;
    if (req.method === "POST") {
      for (const field of ["slug", "name", "category"]) {
        if (!payload[field]) return send(res, 400, { error: field + " is required for a new product." });
      }
      url = root + "/rest/v1/store_products";
    } else {
      const id = typeof body.id === "string" ? body.id : "";
      if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: "A valid product ID is required for updates." });
      url = new URL(root + "/rest/v1/store_products");
      url.searchParams.set("id", "eq." + id);
    }

    const response = await fetch(url, {
      method: req.method,
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const status = response.status === 409 ? 409 : 502;
      return send(res, status, { error: status === 409 ? "That product slug is already in use." : "Product could not be saved. Check required fields and administrator permissions." });
    }

    const saved = await response.json();
    if (!saved[0]) return send(res, 404, { error: "No product was changed." });

    const auditResponse = await fetch(root + "/rest/v1/store_audit_logs", {
      method: "POST",
      headers,
      body: JSON.stringify({
        actor_user_id: user.id,
        action: req.method === "POST" ? "product_created" : "product_updated",
        entity_type: "store_product",
        entity_id: saved[0].id,
        details: { status: saved[0].status, slug: saved[0].slug }
      })
    });

    if (!auditResponse.ok) {
      return send(res, 200, { product: saved[0], warning: "Product saved, but the audit event could not be recorded." });
    }
    return send(res, req.method === "POST" ? 201 : 200, { product: saved[0] });
  } catch {
    return send(res, 502, { error: "Store administration is temporarily unavailable." });
  }
};
