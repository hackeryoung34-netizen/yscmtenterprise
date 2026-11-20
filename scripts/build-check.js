const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const roots = ["api", "scripts"];
const htmlRoots = ["index.html", "business-directory", "jobs", "revenue-admin"];
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
    ["/api/featured-payment/webhook", "/api/revenue?route=featured-webhook"]
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
