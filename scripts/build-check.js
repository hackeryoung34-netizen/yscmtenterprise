const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const roots = ["api", "scripts"];
const htmlRoots = ["index.html", "admin", "business-directory", "jobs", "revenue-admin", "services", "marketplace", "advertising", "affiliates", "communications", "events", "templates", "invoice"];
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith(".js")) files.push(full);
  }
}

for (const name of roots) {
  const dir = path.join(root, name);
  if (fs.existsSync(dir)) walk(dir);
}

let failed = false;

const configPath = path.join(root, "vercel.json");
try {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const rewrites = config.rewrites || [];
  const sources = rewrites.map((rule) => rule.source);
  if (new Set(sources).size !== sources.length) {
    failed = true;
    process.stderr.write("Duplicate Vercel rewrite source detected.\n");
  }
  const requiredRoutes = new Map([
    ["/api/business-directory", "/api/revenue?route=directory"],
    ["/api/admin/business-directory", "/api/revenue?route=admin-directory"],
    ["/api/revenue/health", "/api/revenue?route=health"],
    ["/api/jobs", "/api/revenue?route=jobs"],
    ["/api/admin/jobs", "/api/revenue?route=admin-jobs"],
    ["/api/admin/revenue-health", "/api/revenue?route=admin-health"],
    ["/api/featured-payment", "/api/revenue?route=featured-init"],
    ["/api/featured-payment/verify", "/api/revenue?route=featured-verify"],
    ["/api/featured-payment/webhook", "/api/revenue?route=featured-webhook"],
    ["/api/digital-services", "/api/revenue?route=digital-services"],
    ["/api/marketplace", "/api/revenue?route=marketplace"],
    ["/api/advertising", "/api/revenue?route=advertising"],
    ["/api/affiliates", "/api/revenue?route=affiliates"],
    ["/api/affiliate-click", "/api/revenue?route=affiliate-click"],
    ["/api/communications", "/api/revenue?route=communications"],
    ["/api/admin/enterprise-modules", "/api/revenue?route=admin-enterprise-modules"],
    ["/api/events-sponsorship", "/api/revenue?route=events"],
    ["/api/admin/billing", "/api/revenue?route=admin-billing"],
    ["/api/invoice-payment/webhook", "/api/revenue?route=invoice-webhook"],
    ["/api/invoice-payment", "/api/revenue?route=invoice"]
  ]);
  for (const [source, destination] of requiredRoutes) {
    const rule = rewrites.find((item) => item.source === source);
    if (!rule || rule.destination !== destination) {
      failed = true;
      process.stderr.write("Missing or incorrect Vercel rewrite: " + source + "\n");
    }
  }
} catch (error) {
  failed = true;
  process.stderr.write("Invalid vercel.json: " + error.message + "\n");
}

const revenueApiPath = path.join(root, "api", "revenue.js");
if (fs.existsSync(revenueApiPath)) {
  const revenueApi = fs.readFileSync(revenueApiPath, "utf8");
  const paymentGuards = [
    ['Production requires a live Paystack key', 'key.startsWith("sk_live_")'],
    ['Live checkout is blocked outside Production', 'if(process.env.VERCEL_ENV!=="production")return send(res,403'],
    ['Payment verification requires the live Paystack domain', 'function expectedPaystackDomain(){return "live";}'],
    ['Payment domain is verified', 'payment.domain!==expectedPaystackDomain()'],
    ['Webhook signatures are checked', 'verifyWebhookSignature(req,raw)'],
    ['Webhook raw body parsing is enabled', 'bodyParser:false'],
    ['Raw body parser config is assigned after handler export', 'module.exports.config={api:{bodyParser:false}};'],
    ['Webhook delivery idempotency is enabled', 'on conflict(payload_hash)'],
    ['Webhook route is dispatched', 'route==="featured-webhook"'],
    ['Production featured checkout remains disabled until explicitly enabled', 'process.env.REVENUE_PAYMENTS_ENABLED!=="true"']
  ];
  for (const [label, marker] of paymentGuards) {
    if (!revenueApi.includes(marker)) {
      failed = true;
      process.stderr.write("Missing payment safety check: " + label + "\n");
    }
  }
  if (revenueApi.includes("sk_test_")) {
    failed = true;
    process.stderr.write("Test Paystack mode must not exist in the Featured Business payment flow.\n");
  }
}
const revenueSource = fs.existsSync(revenueApiPath) ? fs.readFileSync(revenueApiPath, "utf8") : "";
if (!revenueSource.includes('if(route==="admin-session")return await adminSession(req,res,getRevenueSql());') ||
    !revenueSource.includes('if(route==="admin-roles")return await centralAdminRoles(req,res,getRevenueSql());') ||
    !revenueSource.includes("async function adminSession(req,res,sql)") ||
    !revenueSource.includes("async function centralAdminRoles(req,res,sql)")) {
  failed = true;
  process.stderr.write("Missing server-enforced central admin RBAC routes.\\n");
}

const billingSourcePath = path.join(root, "api", "_lib", "billing.js");
const reviewMigrationPath = path.join(root, "migrations", "017_customer_reviews.sql");
const reviewMigrationSource = fs.existsSync(reviewMigrationPath) ? fs.readFileSync(reviewMigrationPath, "utf8") : "";
const billingSource = fs.existsSync(billingSourcePath) ? fs.readFileSync(billingSourcePath, "utf8") : "";
const customerPortalPath = path.join(root, "customer-portal", "index.html");
const customerPortalSource = fs.existsSync(customerPortalPath) ? fs.readFileSync(customerPortalPath, "utf8") : "";
const adminBillingPath = path.join(root, "revenue-admin", "billing.html");
const adminBillingSource = fs.existsSync(adminBillingPath) ? fs.readFileSync(adminBillingPath, "utf8") : "";
const homeSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const reviewGuards = [
  ["Public review route is dispatched", revenueSource.includes('if(route==="customer-reviews")return await billing.customerReviews(req,res,getRevenueSql());')],
  ["Customer review endpoint only returns approved reviews", billingSource.includes("where r.status='approved'")],
  ["Review submission is bound to the portal customer's email", billingSource.includes("lower(customer_email)=${access.customer_email}")],
  ["Only closed support tickets may be reviewed", billingSource.includes('ticket[0].status!=="closed"')],
  ["A ticket can only receive one review", reviewMigrationSource.includes("enterprise_customer_reviews_one_per_source")],
  ["Admin review moderation is available", billingSource.includes('action==="moderate_customer_review"')],
  ["Admin review moderation is audit logged", billingSource.includes("'customer_review_moderated'")],
  ["Customer portal contains the review form", customerPortalSource.includes('action:"submit_review"')],
  ["Admin dashboard contains review moderation controls", adminBillingSource.includes("moderate_customer_review")],
  ["Homepage displays approved customer reviews", homeSource.includes("/api/revenue?route=customer-reviews")]
];
for (const [label, ok] of reviewGuards) {
  if (!ok) {
    failed = true;
    process.stderr.write("Missing customer review safety check: " + label + "\\n");
  }
}

const loyaltyMigrationPath = path.join(root, "migrations", "018_customer_loyalty.sql");
const loyaltyMigrationSource = fs.existsSync(loyaltyMigrationPath) ? fs.readFileSync(loyaltyMigrationPath, "utf8") : "";
const loyaltyGuards = [
  ["Verified invoice payments award points idempotently", billingSource.includes("enterprise_customer_loyalty_ledger") && billingSource.includes("on conflict(source_type,source_id) do nothing")],
  ["Customer portal exposes loyalty balance", billingSource.includes("loyalty_history") && billingSource.includes("enterprise_customer_loyalty_ledger")],
  ["Admin billing exposes customer loyalty balances", billingSource.includes("group by customer_email,customer_name")],
  ["Customer portal displays loyalty points", customerPortalSource.includes("YSCMT Rewards") && customerPortalSource.includes("points_balance")],
  ["Admin dashboard displays loyalty balances", adminBillingSource.includes("renderLoyalty") && adminBillingSource.includes("Customer Loyalty & Rewards")],
  ["Loyalty ledger has idempotent invoice source", loyaltyMigrationSource.includes("unique(source_type,source_id)")]
];
for (const [label, ok] of loyaltyGuards) {
  if (!ok) {
    failed = true;
    process.stderr.write("Missing customer loyalty safety check: " + label + "\\n");
  }
}
const retentionGuards = [
  ["Retention segments are derived from verified paid invoices and subscription activity", billingSource.includes("last_paid_at") && billingSource.includes("last_subscription_update") && billingSource.includes("as segment")],
  ["Admin retention dashboard is present", adminBillingSource.includes("Customer Retention & Win-back") && adminBillingSource.includes("renderRetention")],
  ["Win-back outreach is manual and not automatically sent", adminBillingSource.includes("Copy follow-up message") && adminBillingSource.includes("nothing is sent automatically")]
];
for (const [label, ok] of retentionGuards) {
  if (!ok) {
    failed = true;
    process.stderr.write("Missing customer retention safety check: " + label + "\\n");
  }
}
const apiFunctionFiles = files.filter((file) => {
  const relative = path.relative(root, file).split(path.sep);
  return relative[0] === "api" && !relative.some((part) => part.startsWith("_"));
});
if (apiFunctionFiles.length > 12) {
  failed = true;
  process.stderr.write("Vercel Hobby function limit exceeded: " + apiFunctionFiles.length + " API functions (maximum 12).\n");
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
  }
}

for (const name of htmlRoots) {
  const target = path.join(root, name);
  if (!fs.existsSync(target)) continue;
  const htmlFiles = fs.statSync(target).isFile()
    ? [target]
    : fs.readdirSync(target, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
        .map((entry) => path.join(target, entry.name));
  for (const file of htmlFiles) {
    const source = fs.readFileSync(file, "utf8");
    const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter((match) => !/\btype\s*=\s*["']application\/ld\+json["']/i.test(match[1]));
    for (let i = 0; i < scripts.length; i++) {
      try {
        new vm.Script(scripts[i][2], { filename: file + "#script-" + (i + 1) });
      } catch (error) {
        failed = true;
        process.stderr.write(String(error) + "\n");
      }
    }
  }
}

if (failed) process.exit(1);
process.stdout.write("Build check passed: " + files.length + " JavaScript files, inline HTML scripts, Vercel rewrites, and " + apiFunctionFiles.length + " API functions checked.\n");
