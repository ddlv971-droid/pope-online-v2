// ============================================================================
// POPE Online V88 — Interrupteurs fonctionnels
// ============================================================================

function flag(name, defaultValue = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return defaultValue;
  return ['1', 'true', 'yes', 'on', 'oui'].includes(raw);
}

// Espace privé (artisans, indépendants, TPE) : en veille par défaut depuis la V88.
// Le code, les pages et les comptes existants sont conservés ; seules les
// nouvelles inscriptions « private » sont refusées tant que le drapeau est à false.
export function isPrivateSpaceEnabled() {
  return flag('PRIVATE_SPACE_ENABLED', false);
}
