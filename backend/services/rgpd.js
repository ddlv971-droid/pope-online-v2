export function rejectIfSensitive(text){
  const t = (text || '').toLowerCase();
  const patterns = [
    'numéro de sécurité sociale', 'nss', 'carte vitale',
    'dossier médical', 'diagnostic', 'traitement',
    'adresse', 'téléphone', 'date de naissance',
    'rib', 'iban', 'carte bancaire'
  ];
  return patterns.some(p => t.includes(p));
}

export function clamp(s, max=8000){
  if(!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}
