const VERSION = 2;
const MAX_ITEMS = 300;

function safeJsonParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
    usecase: input.usecase || 'note_strategique',
    usecaseLabel,
    title,
    favorite: Boolean(input.favorite),
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

export function buildArchiveFilename(item) {
  const datePart = new Date(item.updatedAt || item.createdAt || Date.now()).toISOString().slice(0, 10);
  return `pope-online-${slugify(item.title || item.usecaseLabel || 'generation')}-${datePart}.json`;
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
    toggleFavorite(id) {
      const item = this.get(id);
      if (!item) return null;
      return this.update(id, { favorite: !item.favorite });
    },
    rename(id, title) {
      return this.update(id, { title: String(title || '').trim() || this.get(id)?.title || 'Génération IA' });
    },
    remove(id) {
      write(read().filter((item) => item.id !== id));
    },
    clear() {
      localStorage.removeItem(key);
    },
    exportAll() {
      return read();
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
    stats() {
      const rows = read();
      const byUsecase = rows.reduce((acc, item) => {
        acc[item.usecase] = (acc[item.usecase] || 0) + 1;
        return acc;
      }, {});
      return {
        total: rows.length,
        favorites: rows.filter((item) => item.favorite).length,
        newestAt: rows[0]?.updatedAt || null,
        byUsecase
      };
    }
  };
}
