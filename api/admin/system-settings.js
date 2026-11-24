const { requireCentralAdmin } = require("../_lib/central-admin");

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

const groups = [
  { name: "Supabase Authentication", description: "Account sign-in, administrator identity and secure server-side CMS access.", items: [
    ["SUPABASE_URL", "Supabase project URL"],
    ["SUPABASE_ANON_KEY", "Supabase public anon key"],
    ["SUPABASE_SERVICE_ROLE_KEY", "Supabase server service-role key"]
  ]},
  { name: "Revenue Database", description: "Private database connection used by Central Admin reporting and staff roles.", items: [
    ["REVENUE_DATABASE_URL", "Revenue database connection URL"]
  ]},
  { name: "Payment Processing", description: "Paystack credentials and feature flags used by Business Directory featured-listing payments.", items: [
    ["REVENUE_PAYSTACK_SECRET_KEY", "Paystack secret key"],
    ["REVENUE_PAYSTACK_WEBHOOK_SECRET", "Paystack webhook secret"],
    ["REVENUE_PAYMENTS_ENABLED", "Revenue payments enabled flag"]
  ]},
  { name: "Abuse Protection", description: "Server-side rate-limit hashing for public listing submissions.", items: [
    ["REVENUE_RATE_LIMIT_SECRET", "Submission rate-limit secret"]
  ]},
  { name: "Object Storage", description: "S3-compatible storage used by revenue and directory assets.", items: [
    ["AWS_ENDPOINT_URL_S3", "S3 endpoint URL"],
    ["AWS_ACCESS_KEY_ID", "Storage access key ID"],
    ["AWS_SECRET_ACCESS_KEY", "Storage secret access key"],
    ["AWS_REGION", "Storage region"],
    ["REVENUE_ASSETS_BUCKET", "Custom assets bucket (optional; defaults to yscmt-revenue-assets)"]
  ]}
];

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return send(res, 405, { error: "Method not allowed." }); }
  const auth = await requireCentralAdmin(req, "settings.read");
  if (auth.error) return send(res, auth.status, { error: auth.error });
  return send(res, 200, {
    generated_at: new Date().toISOString(),
    groups: groups.map(group => ({
      name: group.name,
      description: group.description,
      items: group.items.map(([key, label]) => ({ key, label, configured: Boolean((process.env[key] || "").trim()) }))
    }))
  });
};
