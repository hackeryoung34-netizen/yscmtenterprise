const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const roots = ["api", "scripts"];
const htmlRoots = ["business-directory", "jobs", "revenue-admin"];
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
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
  }
}

for (const name of htmlRoots) {
  const dir = path.join(root, name);
  if (!fs.existsSync(dir)) continue;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    const file = path.join(dir, entry.name);
    const source = fs.readFileSync(file, "utf8");
    const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    for (let i = 0; i < scripts.length; i++) {
      try {
        new vm.Script(scripts[i][1], { filename: file + "#script-" + (i + 1) });
      } catch (error) {
        failed = true;
        process.stderr.write(String(error) + "\n");
      }
    }
  }
}

if (failed) process.exit(1);
process.stdout.write("Build check passed: " + files.length + " JavaScript files and inline HTML scripts passed syntax checks.\n");
