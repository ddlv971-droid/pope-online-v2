import crypto from 'crypto';

export function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest('hex');
}

export function randomToken(size = 32) {
  return crypto.randomBytes(size).toString('hex');
}

export function ipToHash(req) {
  const raw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  // Don't store raw IP; hash it
  return sha256Hex(raw);
}

export function uaToHash(req) {
  return sha256Hex(req.headers['user-agent'] || '');
}

export function nowPlusHours(h) {
  return new Date(Date.now() + h * 3600 * 1000);
}
