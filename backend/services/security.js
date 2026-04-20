import crypto from 'crypto';

export function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest('hex');
}

export function randomToken(size = 32) {
  return crypto.randomBytes(size).toString('hex');
}

export function ipToHash(req) {
  const raw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  return sha256Hex(raw);
}

export function uaToHash(req) {
  return sha256Hex(req.headers['user-agent'] || '');
}

export function nowPlusHours(h) {
  return new Date(Date.now() + h * 3600 * 1000);
}

export function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  return raw.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx <= 0) return acc;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function resolveCookiePolicy() {
  const env = String(process.env.NODE_ENV || '').trim().toLowerCase();
  const secure = env === 'production';
  const explicitSameSite = String(process.env.SESSION_COOKIE_SAMESITE || '').trim();
  let sameSite = explicitSameSite || (secure ? 'None' : 'Lax');
  if (sameSite.toLowerCase() === 'none' && !secure) sameSite = 'Lax';
  return { secure, sameSite };
}

export function setSessionCookie(res, token) {
  const { secure, sameSite } = resolveCookiePolicy();
  const parts = [
    `pope_session=${encodeURIComponent(String(token || ''))}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    'Max-Age=604800'
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res) {
  const { secure, sameSite } = resolveCookiePolicy();
  const parts = [
    'pope_session=',
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    'Max-Age=0'
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export async function verifyTurnstileToken({ token, ip } = {}) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET || '').trim();
  if (!secret) {
    console.warn('TURNSTILE secret missing: validation bypassed');
    return { success: true, bypassed: true };
  }
  if (!String(token || '').trim()) {
    return { success: false, code: 'missing_turnstile_token' };
  }

  const body = new URLSearchParams({
    secret,
    response: String(token || '').trim()
  });
  if (ip) body.set('remoteip', ip);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await response.json().catch(() => ({}));
  return {
    success: !!data.success,
    code: Array.isArray(data['error-codes']) && data['error-codes'][0] ? data['error-codes'][0] : (data.success ? '' : 'turnstile_verification_failed')
  };
}
