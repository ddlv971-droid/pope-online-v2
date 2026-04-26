import jwt from 'jsonwebtoken';
import { withClient } from '../db/index.js';
import { parseCookies } from '../services/security.js';

function extract(req) {
  const h = String(req.headers.authorization || '');
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  const cookies = parseCookies(req);
  return cookies.pope_session || null;
}

async function resolveAuthenticatedUser(req) {
  const token = extract(req);
  if (!token) return { error: 'unauthorized', status: 401 };
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return { error: 'unauthorized', status: 401 };
  }

  const sessionVersion = Number(decoded?.sv || 0);
  const row = await withClient(async (client) => {
    const q = await client.query('select id, email, role, account_space, session_version from users where id=$1 limit 1', [decoded.sub]);
    return q.rows[0] || null;
  });

  if (!row) return { error: 'unauthorized', status: 401 };
  if (Number(row.session_version || 1) !== sessionVersion) return { error: 'unauthorized', status: 401 };

  return {
    user: {
      sub: row.id,
      email: row.email,
      role: row.role || 'client',
      accountSpace: row.account_space || 'public',
      sv: Number(row.session_version || 1)
    }
  };
}

function requestIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '').toString().split(',')[0].trim();
}

function isAdminIpAllowed(req) {
  const allowlist = String(process.env.ADMIN_ALLOWED_IPS || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!allowlist.length) return true;
  return allowlist.includes(requestIp(req));
}

export async function requireAuth(req, res, next) {
  try {
    const result = await resolveAuthenticatedUser(req);
    if (result.error) return res.status(result.status).json({ error: result.error });
    req.user = result.user;
    return next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const result = await resolveAuthenticatedUser(req);
    if (result.error) return res.status(result.status).json({ error: result.error });
    if (result.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    if (!isAdminIpAllowed(req)) return res.status(403).json({ error: 'forbidden' });
    req.user = result.user;
    return next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const result = await resolveAuthenticatedUser(req);
    if (!result.error) req.user = result.user;
  } catch {
    // ignore
  }
  return next();
}
