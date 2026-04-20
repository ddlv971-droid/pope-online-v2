<<<<<<< HEAD

import jwt from 'jsonwebtoken';

function extract(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
=======
import jwt from 'jsonwebtoken';
import { parseCookies } from '../services/security.js';

function extract(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  const cookies = parseCookies(req);
  return cookies.pope_session || null;
>>>>>>> staging
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

export function requireAdmin(req, res, next) {
  const token = extract(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
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
