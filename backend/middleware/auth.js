import jwt from 'jsonwebtoken';
import { parseCookies } from '../services/security.js';

function extract(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  const cookies = parseCookies(req);
  return cookies.pope_session || null;
}

export function requireAuth(req, res, next) {
  const token = extract(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}


function requestIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '').toString().split(',')[0].trim();
}

function isAdminIpAllowed(req) {
  const allowlist = String(process.env.ADMIN_ALLOWED_IPS || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!allowlist.length) return true;
  return allowlist.includes(requestIp(req));
}

export function requireAdmin(req, res, next) {
  const token = extract(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    if (!isAdminIpAllowed(req)) return res.status(403).json({ error: 'forbidden' });
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

export function optionalAuth(req, _res, next) {
  const token = extract(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // ignore
  }
  return next();
}
