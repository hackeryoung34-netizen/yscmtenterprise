const { timingSafeEqual } = require("node:crypto");
const { getRevenueSql } = require("../_lib/revenue-db");
const { getRevenueStorage, HeadBucketCommand } = require("../_lib/revenue-storage");

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.send(JSON.stringify(body));
}

function authorized(req) {
  const expected = process.env.REVENUE_HEALTH_TOKEN;
  const supplied = req.headers.authorization || "";
  if (!expected || !supplied.startsWith("Bearer ")) return false;

  const actualBuffer = Buffer.from(supplied.slice(7));
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Method not allowed" });
  }
  if (!authorized(req)) return send(res, 401, { error: "Unauthorized" });

  const result = { ok: false, postgres: "not_checked", object_storage: "not_checked" };

  try {
    const sql = getRevenueSql();
    await sql`select 1 as health_check`;
    result.postgres = "ok";
  } catch {
    result.postgres = "error";
  }

  try {
    const { client, bucket } = getRevenueStorage();
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    result.object_storage = "ok";
  } catch {
    result.object_storage = "error";
  }

  result.ok = result.postgres === "ok" && result.object_storage === "ok";
  return send(res, result.ok ? 200 : 503, result);
};
