const { neon } = require("@neondatabase/serverless");

let sql;

function getRevenueSql() {
  if (!process.env.REVENUE_DATABASE_URL) {
    throw new Error("Revenue database is not configured.");
  }
  if (!sql) {
    sql = neon(process.env.REVENUE_DATABASE_URL);
  }
  return sql;
}

module.exports = { getRevenueSql };
