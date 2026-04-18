
const VERSION = 9;
const ARCHIVE_PREFIX = 'popeOnlineArchive:';
const AUTO_ARCHIVE_PREFIX = 'popeOnlineArchiveAuto:';
const MAX_ITEMS = 150;

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probe = '__pope_archive_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeJsonParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function text(value='') {
  return String(value ?? '').trim();
}

function slugify(value = '') {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'generation';
}

function usecaseLabelFor(value='') {
  const map = {
    note_strategique: 'Note stratégique / arbitrage',
    courrier: 'Courrier administratif',
    deliberation: 'Projet de délibération',
    synthese_reunion: 'Synthèse de réunion',
    cadrage_projet: 'Cadrage projet / pilotage'
  };
  return map[value] || 'Génération IA';
}

function normalizeRecord(input = {}) {
  const createdAt = input.createdAt || new Date().toISOString();
  const updatedAt = input.updatedAt || createdAt;
  const usecase = text(input.usecase) || 'note_strategique';
  const usecaseLabel = text(input.usecaseLabel) || usecaseLabelFor(usecase);
  const title = text(input.title) || `${usecaseLabel} — ${new Date(createdAt).toLocaleDateString('fr-FR')}`;
  return {
    id: text(input.id) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    version: VERSION,
    createdAt,
    updatedAt,
    title,
    usecase,
    usecaseLabel,
    favorite: Boolean(input.favorite),
    prompt: {
      context: text(input?.prompt?.context),
      objective: text(input?.prompt?.objective),
      facts: text(input?.prompt?.facts)
    },
    result: String(input.result || ''),
    userEmail: text(input.userEmail) || null
  };
}

export function isArchiveStorageAvailable() {
  return Boolean(getStorage());
}

export function getAutoArchivePreference(userId = 'anonymous') {
  const storage = getStorage();
  if (!storage) return false;
  return storage.getItem(`${AUTO_ARCHIVE_PREFIX}${String(userId || 'anonymous')}`) === 'true';
}

export function setAutoArchivePreference(userId = 'anonymous', enabled = false) {
  const storage = getStorage();
  if (!storage) return false;
  storage.setItem(`${AUTO_ARCHIVE_PREFIX}${String(userId || 'anonymous')}`, enabled ? 'true' : 'false');
  return true;
}

export function buildArchiveFilename(item, format = 'json') {
  const datePart = new Date(item.updatedAt || item.createdAt || Date.now()).toISOString().slice(0, 10);
  const base = `pope-online-${slugify(item.title || item.usecaseLabel || 'generation')}-${datePart}`;
  return `${base}.${format}`;
}

export function createArchiveStore({ userId } = {}) {
  const storage = getStorage();
  if (!storage) throw new Error('local_storage_unavailable');
  const key = `${ARCHIVE_PREFIX}${String(userId || 'anonymous')}`;

  function read() {
    return safeJsonParse(storage.getItem(key), [])
      .filter(Boolean)
      .map(normalizeRecord)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }

  function write(rows) {
    storage.setItem(key, JSON.stringify(rows.slice(0, MAX_ITEMS)));
  }

  return {
    list() { return read(); },
    get(id) { return read().find((item) => item.id === id) || null; },
    save(record) {
      const rows = read().filter((item) => item.id !== record?.id);
      const normalized = normalizeRecord(record);
      rows.unshift(normalized);
      write(rows);
      return normalized;
    },
    touch(id) {
      const item = this.get(id);
      if (!item) return null;
      return this.save({ ...item, updatedAt: new Date().toISOString() });
    },
    toggleFavorite(id) {
      const item = this.get(id);
      if (!item) return null;
      return this.save({ ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() });
    },
    remove(id) {
      write(read().filter((item) => item.id !== id));
    },
    clear() {
      storage.removeItem(key);
    },
    exportAll() { return read(); },
    importMany(payload) {
      const incoming = (Array.isArray(payload) ? payload : [payload]).filter(Boolean).map(normalizeRecord);
      const existing = read();
      const ids = new Set();
      const merged = [];
      for (const item of [...incoming, ...existing]) {
        if (ids.has(item.id)) continue;
        ids.add(item.id);
        merged.push(item);
      }
      write(merged);
      return incoming.length;
    },
    stats() {
      const rows = read();
      return {
        total: rows.length,
        favorites: rows.filter((item) => item.favorite).length,
        newestAt: rows[0]?.updatedAt || null
      };
    }
  };
}
