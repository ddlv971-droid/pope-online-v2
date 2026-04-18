const VERSION = 3;
const MAX_ITEMS = 300;

function safeJsonParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'generation';
}

function inferTags(input = {}) {
  const base = [input.usecaseLabel, input.usecase, input?.prompt?.context, input?.prompt?.objective]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const tags = [];
  if (base.includes('courrier')) tags.push('courrier');
  if (base.includes('note')) tags.push('note');
  if (base.includes('délib') || base.includes('delib')) tags.push('deliberation');
  if (base.includes('synth')) tags.push('synthese');
  if (base.includes('cadrage')) tags.push('cadrage');
  return [...new Set(tags)];
}

function normalizeFolder(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function normalizeRecord(input = {}) {
  const createdAt = input.createdAt || new Date().toISOString();
  const updatedAt = input.updatedAt || createdAt;
  const randomPart = Math.random().toString(36).slice(2, 8);
  const id = input.id || `${Date.now().toString(36)}-${randomPart}`;
  const usecaseLabel = String(input.usecaseLabel || 'Génération IA');
  const title = String(input.title || '').trim() || `${usecaseLabel} — ${new Date(createdAt).toLocaleDateString('fr-FR')}`;
  return {
    id,
    version: VERSION,
    createdAt,
    updatedAt,
    archivedAt: input.archivedAt || createdAt,
    lastOpenedAt: input.lastOpenedAt || null,
    usecase: input.usecase || 'note_strategique',
    usecaseLabel,
    title,
    favorite: Boolean(input.favorite),
    folder: normalizeFolder(input.folder || 'Mes archives'),
    notes: String(input.notes || '').trim(),
    tags: Array.isArray(input.tags) ? [...new Set(input.tags.map((v) => String(v).trim()).filter(Boolean))] : inferTags(input),
    prompt: {
      context: String(input?.prompt?.context || ''),
      objective: String(input?.prompt?.objective || ''),
      facts: String(input?.prompt?.facts || '')
    },
    result: String(input.result || ''),
    accountSpace: input.accountSpace || null,
    userEmail: input.userEmail || null
  };
}

export function buildArchiveFilename(item, format = 'json') {
  const datePart = new Date(item.updatedAt || item.createdAt || Date.now()).toISOString().slice(0, 10);
  const base = `pope-online-${slugify(item.title || item.usecaseLabel || 'generation')}-${datePart}`;
  return format === 'json' ? `${base}.json` : `${base}.${format}`;
}

export function formatArchiveAsText(item) {
  return [
    `POPE Online — ${item.title || item.usecaseLabel || 'Génération IA'}`,
    `Type : ${item.usecaseLabel || 'Génération IA'}`,
    `Dossier : ${item.folder || 'Mes archives'}`,
    `Créée le : ${item.createdAt ? new Date(item.createdAt).toLocaleString('fr-FR') : '—'}`,
    `Dernière mise à jour : ${item.updatedAt ? new Date(item.updatedAt).toLocaleString('fr-FR') : '—'}`,
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
    item?.result || '-',
    item.notes ? `
NOTES
${item.notes}` : ''
  ].filter(Boolean).join('
');
}

export function formatArchiveAsHtml(item) {
  const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(item.title || item.usecaseLabel || 'Archive POPE Online')}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#07162A}h1,h2{color:#0c5ea8}pre{white-space:pre-wrap;font-family:inherit;line-height:1.55;background:#f7fbff;border:1px solid #dce9f6;border-radius:12px;padding:14px}section{margin:0 0 24px}</style></head><body><h1>${esc(item.title || item.usecaseLabel || 'Archive POPE Online')}</h1><p><strong>Type :</strong> ${esc(item.usecaseLabel || 'Génération IA')}<br><strong>Dossier :</strong> ${esc(item.folder || 'Mes archives')}<br><strong>Créée le :</strong> ${esc(item.createdAt ? new Date(item.createdAt).toLocaleString('fr-FR') : '—')}<br><strong>Mise à jour :</strong> ${esc(item.updatedAt ? new Date(item.updatedAt).toLocaleString('fr-FR') : '—')}</p><section><h2>Contexte</h2><pre>${esc(item?.prompt?.context || '-')}</pre></section><section><h2>Objectif</h2><pre>${esc(item?.prompt?.objective || '-')}</pre></section><section><h2>Éléments factuels</h2><pre>${esc(item?.prompt?.facts || '-')}</pre></section><section><h2>Génération</h2><pre>${esc(item?.result || '-')}</pre></section>${item.notes ? `<section><h2>Notes</h2><pre>${esc(item.notes)}</pre></section>` : ''}</body></html>`;
}

export function createArchiveStore({ userId }) {
  const key = `popeOnlineArchive:${String(userId || 'anonymous')}`;

  function read() {
    return safeJsonParse(localStorage.getItem(key), [])
      .map(normalizeRecord)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }

  function write(rows) {
    localStorage.setItem(key, JSON.stringify(rows.slice(0, MAX_ITEMS)));
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
    update(id, patch = {}) {
      const rows = read();
      const idx = rows.findIndex((item) => item.id === id);
      if (idx < 0) return null;
      rows[idx] = normalizeRecord({ ...rows[idx], ...patch, updatedAt: new Date().toISOString() });
      write(rows);
      return rows[idx];
    },
    touch(id) {
      return this.update(id, { lastOpenedAt: new Date().toISOString() });
    },
    toggleFavorite(id) {
      const item = this.get(id);
      if (!item) return null;
      return this.update(id, { favorite: !item.favorite });
    },
    rename(id, title) {
      return this.update(id, { title: String(title || '').trim() || this.get(id)?.title || 'Génération IA' });
    },
    setFolder(id, folder) {
      return this.update(id, { folder: normalizeFolder(folder || 'Mes archives') || 'Mes archives' });
    },
    setNotes(id, notes) {
      return this.update(id, { notes: String(notes || '').trim() });
    },
    duplicate(id) {
      const item = this.get(id);
      if (!item) return null;
      const copy = normalizeRecord({ ...item, id: undefined, favorite: false, title: `${item.title || item.usecaseLabel || 'Génération IA'} — copie`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), archivedAt: new Date().toISOString(), lastOpenedAt: null });
      const rows = read();
      rows.unshift(copy);
      write(rows);
      return copy;
    },
    remove(id) {
      write(read().filter((item) => item.id !== id));
    },
    removeMany(ids = []) {
      const set = new Set(ids);
      write(read().filter((item) => !set.has(item.id)));
    },
    clear() {
      localStorage.removeItem(key);
    },
    exportAll() {
      return read();
    },
    exportMany(ids = []) {
      const set = new Set(ids);
      return read().filter((item) => set.has(item.id));
    },
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
    folders() {
      const rows = read();
      return [...new Set(rows.map((item) => item.folder || 'Mes archives'))].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    },
    stats() {
      const rows = read();
      const byUsecase = rows.reduce((acc, item) => {
        acc[item.usecase] = (acc[item.usecase] || 0) + 1;
        return acc;
      }, {});
      const byFolder = rows.reduce((acc, item) => {
        const key = item.folder || 'Mes archives';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return {
        total: rows.length,
        favorites: rows.filter((item) => item.favorite).length,
        newestAt: rows[0]?.updatedAt || null,
        folders: Object.keys(byFolder).length,
        byUsecase,
        byFolder
      };
    }
  };
}
