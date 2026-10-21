// V90.3 — Protection des connexions par COMPTE (en plus de la limite par IP).
// - Verrouillage temporaire après trop d'échecs sur un même e-mail.
// - Faux contrôle de mot de passe pour un compte inconnu (temps de réponse identique,
//   afin de ne pas révéler quels e-mails existent).
import bcrypt from 'bcryptjs';

const MAX_FAILS = Number(process.env.LOGIN_MAX_FAILS || 8);
const WINDOW_MS = Number(process.env.LOGIN_LOCK_MINUTES || 15) * 60 * 1000;
const fails = new Map(); // email -> { n, first, lockedUntil }
const DUMMY_HASH = bcrypt.hashSync('pope-online-dummy-password', 12);

function key(email) { return String(email || '').trim().toLowerCase(); }

export function isLocked(email) {
  const e = fails.get(key(email));
  return !!(e && e.lockedUntil && e.lockedUntil > Date.now());
}

export function recordFailure(email) {
  const k = key(email);
  const now = Date.now();
  let e = fails.get(k);
  if (!e || now - e.first > WINDOW_MS) e = { n: 0, first: now, lockedUntil: 0 };
  e.n += 1;
  if (e.n >= MAX_FAILS) e.lockedUntil = now + WINDOW_MS;
  fails.set(k, e);
  if (fails.size > 5000) { // borne mémoire
    for (const [kk, v] of fails) if (now - v.first > WINDOW_MS) fails.delete(kk);
  }
}

export function recordSuccess(email) { fails.delete(key(email)); }

export async function dummyCompare(password) {
  try { await bcrypt.compare(String(password || ''), DUMMY_HASH); } catch {}
}
