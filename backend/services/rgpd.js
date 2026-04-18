function hasStrongIdentifier(text = '') {
  const patterns = [
    /\b\d{13}\b/,
    /\bfr\d{2}[a-z0-9]{11,30}\b/i,
    /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/i,
    /\b(?:\d[ -]*?){13,19}\b/,
    /\b(?:num[eé]ro\s+de\s+s[ée]curit[ée]\s+sociale|nss|iban|rib|carte\s+bancaire|cvv|cryptogramme|carte\s+vitale)\b/i
  ];
  return patterns.some((re) => re.test(text));
}

function hasMedicalBundle(text = '') {
  const t = String(text || '').toLowerCase();
  const medical = ['dossier médical', 'diagnostic', 'traitement', 'pathologie', 'ordonnance'];
  let count = 0;
  for (const word of medical) if (t.includes(word)) count += 1;
  return count >= 2;
}

export function rejectIfSensitive(text){
  const raw = String(text || '');
  if (!raw.trim()) return false;
  return hasStrongIdentifier(raw) || hasMedicalBundle(raw);
}

export function clamp(s, max=8000){
  if(!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}
