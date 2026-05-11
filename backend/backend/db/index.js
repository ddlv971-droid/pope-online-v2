import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false)
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } catch (err) {
    // Rollback automatique si une transaction est en cours
    try { await client.query('rollback'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}
