import jwt from 'jsonwebtoken';

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, item) => {
    const idx = item.indexOf('=');
    if (idx <= 0) return acc;
    const key = item.slice(0, idx).trim();
    const value = decodeURIComponent(item.slice(idx + 1).trim());
    acc[key] = value;
    return acc;
  }, {});
}

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
