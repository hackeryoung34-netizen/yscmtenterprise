const { neon } = require("@neondatabase/serverless");

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Method not allowed." });
  }

  const connectionString = process.env.YSCMT_STUDENT_PORTAL_DATABASE_URL;
  if (!connectionString) {
    return send(res, 503, { error: "Student Portal is not connected yet." });
  }

  try {
    const sql = neon(connectionString);
    const courses = await sql`
      SELECT id, title, description, level, fee_amount, fee_currency
      FROM public.courses
      WHERE active = true
      ORDER BY title ASC
    `;
    return send(res, 200, { courses });
  } catch {
    return send(res, 503, { error: "Course catalogue is temporarily unavailable." });
  }
};
