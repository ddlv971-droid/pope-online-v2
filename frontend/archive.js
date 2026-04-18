(function () {
  const ARCHIVE_KEY = 'pope_online_archives_v12';
  const AUTO_KEY = 'pope_online_auto_archive_v12';
  const MAX_ITEMS = 100;

  function canUseStorage() {
    try {
      const k = '__pope_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  const enabled = canUseStorage();

  function read() {
    if (!enabled) return [];
    try {
      const rows = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function write(rows) {
    if (!enabled) return;
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(rows.slice(0, MAX_ITEMS)));
  }

  function normalize(item) {
    return {
      id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: item.title || 'Génération IA',
      prompt: item.prompt || '',
      result: item.result || '',
      createdAt: item.createdAt || new Date().toISOString()
    };
  }

  window.ArchiveStore = {
    isAvailable() { return enabled; },
    list() {
      return read().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    save(item) {
      if (!enabled) return null;
      const rows = read();
      const normalized = normalize(item);
      rows.unshift(normalized);
      write(rows);
      return normalized;
    },
    remove(id) {
      write(read().filter(item => item.id !== id));
    },
    clear() {
      if (!enabled) return;
      localStorage.removeItem(ARCHIVE_KEY);
    },
    exportAll() {
      return JSON.stringify(this.list(), null, 2);
    },
    autoEnabled() {
      if (!enabled) return false;
      return localStorage.getItem(AUTO_KEY) === 'true';
    },
    setAuto(value) {
      if (!enabled) return false;
      localStorage.setItem(AUTO_KEY, value ? 'true' : 'false');
      return true;
    }
  };
})();
