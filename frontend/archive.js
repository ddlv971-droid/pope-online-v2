const ARCHIVE_PREFIX = 'pope_archive_v10:';
const AUTO_PREFIX = 'pope_archive_auto_v10:';
const MAX_ITEMS = 50;

function getStorage() {
  try {
    const s = window.localStorage;
    const k = '__pope_archive_test__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

function text(value = '') {
  return String(value || '').trim();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function normalizeRecord(input = {}) {
  const createdAt = input.createdAt || new Date().toISOString();
  return {
    id: text(input.id) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    updatedAt: input.updatedAt || createdAt,
    title: text(input.title) || 'Génération IA',
    usecaseLabel: text(input.usecaseLabel) || 'Génération IA',
    prompt: {
      context: text(input?.prompt?.context),
      objective: text(input?.prompt?.objective),
      facts: text(input?.prompt?.facts)
    },
    result: String(input.result || ''),
    favorite: Boolean(input.favorite)
  };
}

export function isArchiveStorageAvailable() {
  return Boolean(getStorage());
}

export function getAutoArchivePreference(userKey = 'anonymous') {
  const s = getStorage();
  if (!s) return false;
  return s.getItem(`${AUTO_PREFIX}${userKey}`) === 'true';
}

export function setAutoArchivePreference(userKey = 'anonymous', enabled = false) {
  const s = getStorage();
  if (!s) return false;
  s.setItem(`${AUTO_PREFIX}${userKey}`, enabled ? 'true' : 'false');
  return true;
}

export function buildArchiveFilename(item, format = 'json') {
  const safe = text(item?.title || 'generation').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'generation';
  const datePart = new Date(item?.updatedAt || item?.createdAt || Date.now()).toISOString().slice(0, 10);
  return `pope-online-${safe}-${datePart}.${format}`;
}

export function createArchiveStore({ userId } = {}) {
  const s = getStorage();
  if (!s) throw new Error('local_storage_unavailable');
  const key = `${ARCHIVE_PREFIX}${text(userId) || 'anonymous'}`;

  function read() {
    const rows = JSON.parse(s.getItem(key) || '[]');
    return Array.isArray(rows) ? rows.map(normalizeRecord).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)) : [];
  }

  function write(rows) {
    s.setItem(key, JSON.stringify(rows.slice(0, MAX_ITEMS)));
  }

  return {
    list() { return read(); },
    save(record) {
      const item = normalizeRecord(record);
      const rows = read().filter((row) => row.id !== item.id);
      rows.unshift(item);
      write(rows);
      return item;
    },
    get(id) { return read().find((row) => row.id === id) || null; },
    remove(id) { write(read().filter((row) => row.id !== id)); },
    clear() { s.removeItem(key); },
    toggleFavorite(id) {
      const item = this.get(id);
      if (!item) return null;
      return this.save({ ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() });
    },
    exportAll() { return read(); },
    importMany(payload) {
      const incoming = (Array.isArray(payload) ? payload : [payload]).filter(Boolean).map(normalizeRecord);
      const current = read();
      const seen = new Set();
      const merged = [];
      for (const row of [...incoming, ...current]) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        merged.push(row);
      }
      write(merged);
      return incoming.length;
    },
    stats() {
      const rows = read();
      return {
        total: rows.length,
        favorites: rows.filter((row) => row.favorite).length,
        latest: rows[0]?.updatedAt || null
      };
    }
  };
}

export function archivePreviewHtml(item) {
  return `
    <article class="archive-card-v10" data-archive-id="${escapeHtml(item.id)}">
      <div class="archive-card-v10-head">
        <div>
          <div class="archive-card-v10-title">${escapeHtml(item.title)}</div>
          <div class="archive-card-v10-meta">${escapeHtml(item.usecaseLabel)} · ${new Date(item.updatedAt || item.createdAt).toLocaleString('fr-FR')}</div>
        </div>
        <button class="btn ghost archive-fav-v10" type="button" data-action="favorite">${item.favorite ? '★' : '☆'}</button>
      </div>
      <div class="archive-card-v10-body">${escapeHtml((item.result || '').replace(/\s+/g, ' ').slice(0, 180))}${(item.result || '').length > 180 ? '…' : ''}</div>
      <div class="archive-card-v10-actions">
        <button class="btn ghost" type="button" data-action="load">Réouvrir</button>
        <button class="btn ghost" type="button" data-action="copy">Copier</button>
        <button class="btn ghost" type="button" data-action="download">Télécharger</button>
        <button class="btn ghost" type="button" data-action="delete">Supprimer</button>
      </div>
    </article>
  `;
}
