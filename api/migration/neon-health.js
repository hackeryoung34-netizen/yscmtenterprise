import { neon } from '@neondatabase/serverless';

const targets = [
  ['student-portal', 'YSCMT_STUDENT_PORTAL_DATABASE_URL', 'courses'],
  ['connect', 'YSCMT_CONNECT_DATABASE_URL', 'community_profiles'],
  ['adforge-ai', 'YSCMT_ADFORGE_DATABASE_URL', 'creations']
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const checks = await Promise.all(targets.map(async ([app, envName, table]) => {
    const connectionString = process.env[envName];
    if (!connectionString) return { app, configured: false, connected: false };

    try {
      const sql = neon(connectionString);
      const rows = await sql`SELECT to_regclass(${'public.' + table}) AS table_name`;
      return {
        app,
        configured: true,
        connected: Boolean(rows[0]?.table_name),
        schemaReady: Boolean(rows[0]?.table_name)
      };
    } catch {
      return { app, configured: true, connected: false, schemaReady: false };
    }
  }));

  const ready = checks.every(x => x.configured && x.connected && x.schemaReady);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'setup_required',
    checks
  });
}
