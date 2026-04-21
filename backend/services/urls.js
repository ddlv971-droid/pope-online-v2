
function sanitizeBaseUrl(input = '') {
  return String(input || '').trim().replace(/\/$/, '')
    .replace(/^http:\/\/popeonlinev1\.netlify\.app$/i, 'https://pope-online.com')
    .replace(/^https:\/\/popeonlinev1\.netlify\.app$/i, 'https://pope-online.com');
}

function parseOrigins(raw = '') {
  return String(raw || '').split(',').map((v) => sanitizeBaseUrl(v)).filter(Boolean);
}

function isProductionCustomDomain(url = '') {
  return /^https:\/\/(www\.)?pope-online\.com$/i.test(String(url || ''));
}

function looksLikeStaging(url = '') {
  return /staging/i.test(String(url || '')) || /localhost/i.test(String(url || ''));
}

function looksLikeNetlify(url = '') {
  return /\.netlify\.app$/i.test(String(url || ''));
}

export function resolveFrontendBaseUrl(env = process.env) {
  const explicit = sanitizeBaseUrl(env.FRONTEND_CANONICAL_URL || env.PUBLIC_APP_URL || '');
  const rawBase = sanitizeBaseUrl(env.FRONTEND_BASE_URL || '');
  const origins = parseOrigins(env.CORS_ORIGIN || '');
  const productionDomain = origins.find(isProductionCustomDomain) || (isProductionCustomDomain(rawBase) ? rawBase : '');
  const stagingDomain = origins.find(looksLikeStaging) || (looksLikeStaging(rawBase) ? rawBase : '') || (looksLikeStaging(explicit) ? explicit : '');

  const candidates = [explicit, rawBase, productionDomain, stagingDomain].filter(Boolean);
  for (const candidate of candidates) {
    if (looksLikeStaging(candidate)) return candidate;
    if (isProductionCustomDomain(candidate)) return candidate;
  }

  if (productionDomain) return productionDomain;
  if (explicit && looksLikeNetlify(explicit) && !looksLikeStaging(explicit)) return 'https://pope-online.com';
  if (rawBase && looksLikeNetlify(rawBase) && !looksLikeStaging(rawBase)) return 'https://pope-online.com';
  return explicit || rawBase || productionDomain || stagingDomain || 'https://pope-online.com';
}
