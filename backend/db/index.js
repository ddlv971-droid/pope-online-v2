import pg from 'pg';

const { Pool } = pg;

if (!String(process.env.DATABASE_URL || '').trim()) {
  throw new Error('DATABASE_URL manquante');
}

function resolveSsl() {
  if (process.env.PGSSLMODE === 'disable') return false;
  if (process.env.NODE_ENV !== 'production') return false;
  const allowInsecure = String(process.env.PG_SSL_ALLOW_INSECURE || '').trim().toLowerCase() === 'true';
  if (allowInsecure) {
    console.warn('⚠️ Connexion PostgreSQL TLS sans vérification stricte du certificat (dette de sécurité temporaire).');
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl()
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
