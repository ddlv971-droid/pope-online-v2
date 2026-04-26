function hasStrongIdentifier(text = '') {
  const t = String(text || '');
  // Identifiants numériques longs (IBAN, carte bancaire, NIR...)
  const numericPatterns = [
    /\b\d{13}\b/,                          // NIR, EAN-13
    /\bfr\d{2}[a-z0-9]{11,30}\b/i,         // IBAN FR...
    /\b[A-Z]{2}\d{2}[A-Z0-9]{14,30}\b/i,   // IBAN international (min 14 car après CC+2)
    /\b(?:\d[ -]*?){16,19}\b/,              // Carte bancaire (16-19 chiffres) - relevé 13+ trop large
  ];
  if (numericPatterns.some((re) => re.test(t))) return true;

  // Mots-clés sensibles AVEC contexte numérique proche (évite les faux positifs documentaires)
  // "RIB" seul dans un document administratif n'est pas sensible
  // "mon RIB : FR76..." ou "IBAN : ..." l'est
  const sensitiveWithContext = [
    /(?:num[eé]ro\s+de\s+)?s[ée]curit[ée]\s+sociale\s*:?\s*\d/i,
    /\biban\s*:?\s*[A-Z]{2}\d/i,
    /\brib\s*:?\s*\d/i,
    /\bcvv\s*:?\s*\d/i,
    /\bcryptogramme\s*:?\s*\d/i,
    /\bcarte\s+(?:bancaire|vitale)\s*:?\s*\d/i,
    /\bnss\s*:?\s*\d/i,
  ];
  return sensitiveWithContext.some((re) => re.test(t));
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
