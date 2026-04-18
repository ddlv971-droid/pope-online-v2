const VERSION = 8;
const ARCHIVE_PREFIX = 'popeOnlineArchive:';
const AUTO_ARCHIVE_PREFIX = 'popeOnlineArchiveAuto:';
const MAX_ITEMS = 120;

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
  return String(value || '').trim();
}

function slugify(value = '') {
  return text(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

export function formatArchiveAsText(item) {
  return [
    `POPE Online — ${item.title || item.usecaseLabel || 'Génération IA'}`,
    `Type : ${item.usecaseLabel || 'Génération IA'}`,
    `Créée le : ${item.createdAt ? new Date(item.createdAt).toLocaleString('fr-FR') : '—'}`,
    '',
    'CONTEXTE',
    item?.prompt?.context || '-',
    '',
    'OBJECTIF',
    item?.prompt?.objective || '-',
    '',
    'ÉLÉMENTS FACTUELS',
    item?.prompt?.facts || '-',
    '',
    'GÉNÉRATION',
    item?.result || '-'
  ].join('
');
}

export function formatArchiveAsHtml(item) {
  const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(item.title || item.usecaseLabel || 'Archive POPE Online')}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#07162A}h1,h2{color:#0c5ea8}pre{white-space:pre-wrap;font-family:inherit;line-height:1.55;background:#f7fbff;border:1px solid #dce9f6;border-radius:12px;padding:14px}section{margin:0 0 24px}</style></head><body><h1>${esc(item.title || item.usecaseLabel || 'Archive POPE Online')}</h1><p><strong>Type :</strong> ${esc(item.usecaseLabel || 'Génération IA')}<br><strong>Créée le :</strong> ${esc(item.createdAt ? new Date(item.createdAt).toLocaleString('fr-FR') : '—')}</p><section><h2>Contexte</h2><pre>${esc(item?.prompt?.context || '-')}</pre></section><section><h2>Objectif</h2><pre>${esc(item?.prompt?.objective || '-')}</pre></section><section><h2>Éléments factuels utiles</h2><pre>${esc(item?.prompt?.facts || '-')}</pre></section><section><h2>Génération</h2><pre>${esc(item?.result || '-')}</pre></section></body></html>`;
}

export function createArchiveStore({ userId } = {}) {
  const storage = getStorage();
  if (!storage) throw new Error('local_storage_unavailable');
  const key = `${ARCHIVE_PREFIX}${String(userId || 'anonymous')}`;

  function read() {
    return safeJsonParse(storage.getItem(key), [])
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
      const rows = read();
      const normalized = normalizeRecord(record);
      rows.unshift(normalized);
      write(rows);
      return normalized;
    },
    touch(id) {
      const rows = read();
      const idx = rows.findIndex((item) => item.id === id);
      if (idx < 0) return null;
      rows[idx] = normalizeRecord({ ...rows[idx], updatedAt: new Date().toISOString() });
      write(rows);
      return rows[idx];
    },
    toggleFavorite(id) {
      const rows = read();
      const idx = rows.findIndex((item) => item.id === id);
      if (idx < 0) return null;
      rows[idx] = normalizeRecord({ ...rows[idx], favorite: !rows[idx].favorite, updatedAt: new Date().toISOString() });
      write(rows);
      return rows[idx];
    },
    remove(id) {
      write(read().filter((item) => item.id !== id));
    },
    clear() {
      storage.removeItem(key);
    },
    exportAll() { return read(); },
    importMany(payload) {
      const incoming = Array.isArray(payload) ? payload : [payload];
      const current = read();
      const merged = [...incoming.map(normalizeRecord), ...current].reduce((acc, item) => {
        if (!acc.some((existing) => existing.id === item.id)) acc.push(item);
        return acc;
      }, []);
      write(merged.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)));
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
