const siteKey = typeof import.meta !== 'undefined' && import.meta.env ? String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim() : '';
let widgetId = null;

function ensureScript() {
  return new Promise((resolve, reject) => {
    if (!siteKey) return resolve(null);
    if (window.turnstile) return resolve(window.turnstile);
    const existing = document.querySelector('script[data-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = '1';
    script.onload = () => resolve(window.turnstile);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function mountTurnstile(containerId) {
  const host = document.getElementById(containerId);
  if (!host || !siteKey) {
    if (host) host.hidden = true;
    return false;
  }
  const turnstile = await ensureScript();
  if (!turnstile) return false;
  if (widgetId !== null) {
    try { turnstile.remove(widgetId); } catch {}
    widgetId = null;
  }
  host.hidden = false;
  widgetId = turnstile.render(host, { sitekey: siteKey, theme: 'light' });
  return true;
}

export function getTurnstileToken() {
  if (!siteKey) return '';
  if (!window.turnstile || widgetId === null) return '';
  return window.turnstile.getResponse(widgetId) || '';
}

export function resetTurnstile() {
  if (!siteKey) return;
  if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
}

export function isTurnstileConfigured() {
  return !!siteKey;
}
