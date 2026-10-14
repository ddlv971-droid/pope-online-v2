// ============================================================================
// POPE Online V89.3 — Règles anti-abus communes aux formulaires publics (formGuard.js : nom distinct de antiAbuse.js, qui sert à l'inscription)
// (contact / rendez-vous conseiller, diagnostic flash).
// ============================================================================
import { verifyTurnstileToken } from './security.js';

export const MIN_FILL_MS = 3000;                 // formulaire rempli plus vite = robot
const ACK_PER_HOUR = 40;                         // accusés de réception, tous formulaires confondus
let ackWindow = { start: Date.now(), n: 0 };

export const URLISH = /(https?:\/\/|www\.|\.(com|net|org|ru|xyz|io|info|top|click)\b)/i;

// Budget global d'accusés de réception : empêche d'utiliser nos formulaires
// pour envoyer des e-mails en masse à des tiers.
export function takeAckBudget() {
  if (Date.now() - ackWindow.start > 3600e3) ackWindow = { start: Date.now(), n: 0 };
  if (ackWindow.n >= ACK_PER_HOUR) return false;
  ackWindow.n += 1; return true;
}

// Téléphone : 6 à 20 chiffres, caractères usuels seulement
export function badPhone(phone) {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '').length;
  return digits < 6 || digits > 20 || /[^0-9+().\s-]/.test(phone);
}

// Contrôle « humain » : délai de saisie et Cloudflare Turnstile.
// Retourne { drop } (ignorer en silence), { reject } (403) ou { verified }.
export async function humanCheck(b, ip) {
  const elapsed = Number(b.elapsed_ms) || 0;
  if (elapsed > 0 && elapsed < MIN_FILL_MS) return { drop: true };
  try {
    const ts = await verifyTurnstileToken({ token: b.turnstileToken, ip });
    if (ts.success) return { verified: true };
    if (ts.code === 'turnstile_not_configured' || ts.code === 'missing_turnstile_token') return { verified: elapsed >= MIN_FILL_MS };
    return { reject: true };
  } catch (e) {
    console.warn('[anti-abus] turnstile injoignable :', e.message);
    return { verified: elapsed >= MIN_FILL_MS };
  }
}
