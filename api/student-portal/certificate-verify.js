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

  const code = String(req.query?.code || "").trim().toUpperCase();
  if (!/^YSCMT-[0-9]{4}-[A-F0-9]{12}$/.test(code)) {
    return send(res, 400, { valid: false, error: "Enter a valid YSCMT certificate code." });
  }

  const connectionString = process.env.YSCMT_STUDENT_PORTAL_DATABASE_URL;
  if (!connectionString) {
    return send(res, 503, { valid: false, error: "Certificate verification is temporarily unavailable." });
  }

  try {
    const sql = neon(connectionString);
    const rows = await sql`
      SELECT certificate_code, student_name, course_title, issued_at
      FROM public.student_certificates
      WHERE certificate_code = ${code}
      LIMIT 1
    `;
    if (!rows.length) {
      return send(res, 404, { valid: false, message: "No certificate matches this code." });
    }
    return send(res, 200, { valid: true, certificate: rows[0] });
  } catch {
    return send(res, 503, { valid: false, error: "Certificate verification is temporarily unavailable." });
  }
};
