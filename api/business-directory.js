const { getRevenueSql } = require("./_lib/revenue-db");

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.send(JSON.stringify(body));
}

const categories = new Set([
  "technology", "education", "professional-services", "health", "retail",
  "food-hospitality", "construction", "transport", "beauty-wellness",
  "agriculture", "other"
]);
const states = new Set([
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
  "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
  "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba",
  "Yobe","Zamfara"
]);
const recentSubmissions = new Map();

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function validEmail(value) {
  return !value || (value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}
function validUrl(value) {
  if (!value) return true;
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch { return false; }
}
function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}
function limited(ip) {
  const now = Date.now();
  const entry = recentSubmissions.get(ip);
  if (entry && now - entry.started < 60 * 60 * 1000 && entry.count >= 3) return true;
  if (!entry || now - entry.started >= 60 * 60 * 1000) recentSubmissions.set(ip, { started: now, count: 1 });
  else entry.count += 1;
  if (recentSubmissions.size > 5000) {
    for (const [key, value] of recentSubmissions) if (now - value.started >= 60 * 60 * 1000) recentSubmissions.delete(key);
  }
  return false;
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed" });
  }
  try {
    const sql = getRevenueSql();
    if (req.method === "GET") {
      const q = clean(req.query && req.query.q, 100);
      const state = clean(req.query && req.query.state, 80);
      const city = clean(req.query && req.query.city, 100);
      const category = clean(req.query && req.query.category, 40);
      const page = Math.max(1, Math.min(10000, Number.parseInt(req.query && req.query.page, 10) || 1));
      const limit = Math.max(1, Math.min(50, Number.parseInt(req.query && req.query.limit, 10) || 20));
      if (category && !categories.has(category)) return send(res, 400, { error: "Invalid category." });
      const stateFilter = state || null, cityFilter = city || null, categoryFilter = category || null, queryFilter = q || null;
      const rows = await sql`
        select id, business_name, slug, category, description, state, city,
          phone, whatsapp, email, website_url, logo_object_key,
          (is_featured and featured_until > now()) as featured,
          created_at
        from public.business_directory_listings
        where status = 'approved'
          and (${stateFilter}::text is null or state ilike ${stateFilter})
          and (${cityFilter}::text is null or city ilike ${cityFilter})
          and (${categoryFilter}::text is null or category = ${categoryFilter})
          and (${queryFilter}::text is null or business_name ilike ('%' || ${queryFilter} || '%') or description ilike ('%' || ${queryFilter} || '%'))
        order by (is_featured and featured_until > now()) desc, created_at desc
        limit ${limit} offset ${(page - 1) * limit}
      `;
      return send(res, 200, { listings: rows, page, limit });
    }

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    // Honeypot: bots receive a neutral acknowledgement without creating a record.
    if (clean(body.website_confirm, 200)) return send(res, 202, { accepted: true });
    const ip = String(req.headers["x-forwarded-for"] || req.socket && req.socket.remoteAddress || "unknown").split(",")[0].trim();
    if (limited(ip)) return send(res, 429, { error: "Too many submissions. Please try again later." });

    const business_name = clean(body.business_name, 160);
    const category = clean(body.category, 40);
    const description = clean(body.description, 3000);
    const state = clean(body.state, 80);
    const city = clean(body.city, 100);
    const phone = clean(body.phone, 30).replace(/[\s()-]/g, "");
    const whatsapp = clean(body.whatsapp, 30).replace(/[\s()-]/g, "") || null;
    const email = clean(body.email, 254) || null;
    const website_url = clean(body.website_url, 2048) || null;
    if (business_name.length < 2 || description.length < 20 || description.length > 3000) {
      return send(res, 400, { error: "Business name and a description of at least 20 characters are required." });
    }
    if (!categories.has(category)) return send(res, 400, { error: "Select a valid business category." });
    if (!states.has(state)) return send(res, 400, { error: "Select a valid Nigerian state." });
    if (city.length < 2) return send(res, 400, { error: "Enter a valid city." });
    if (!/^\+?[0-9]{7,15}$/.test(phone) || (whatsapp && !/^\+?[0-9]{7,15}$/.test(whatsapp))) {
      return send(res, 400, { error: "Enter a valid phone number." });
    }
    if (!validEmail(email) || !validUrl(website_url)) return send(res, 400, { error: "Check the email address or website URL." });

    const baseSlug = slugify(business_name);
    if (!baseSlug) return send(res, 400, { error: "Business name cannot be converted to a valid listing URL." });
    const suffix = Math.random().toString(36).slice(2, 8);
    const slug = baseSlug + "-" + suffix;
    const inserted = await sql`
      insert into public.business_directory_listings
        (business_name, slug, category, description, state, city, phone, whatsapp, email, website_url)
      values
        (${business_name}, ${slug}, ${category}, ${description}, ${state}, ${city},
         ${phone}, ${whatsapp}, ${email}, ${website_url})
      returning id, business_name, slug, status, created_at
    `;
    return send(res, 201, { listing: inserted[0], message: "Your listing has been submitted for review." });
  } catch {
    return send(res, 503, { error: "Business Directory is temporarily unavailable." });
  }
};
