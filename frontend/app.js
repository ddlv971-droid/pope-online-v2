(function () {
  const promptField = document.getElementById('prompt');
  const generateBtn = document.getElementById('generateBtn');
  const resultEl = document.getElementById('result');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const archiveList = document.getElementById('archiveList');
  const archiveBtn = document.getElementById('archiveBtn');
  const autoArchiveToggle = document.getElementById('autoArchiveToggle');
  const archiveSearch = document.getElementById('archiveSearch');
  const copyResultBtn = document.getElementById('copyResultBtn');
  const downloadResultBtn = document.getElementById('downloadResultBtn');
  const exportArchivesBtn = document.getElementById('exportArchivesBtn');
  const clearArchivesBtn = document.getElementById('clearArchivesBtn');

  let lastGeneration = null;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[ch]));
  }

  function formatInline(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  function renderMarkdownTable(lines) {
    const rows = lines.map(line => line.trim()).filter(Boolean);
    if (rows.length < 2) return null;
    const head = rows[0].split('|').map(s => s.trim()).filter(Boolean);
    const sep = rows[1];
    if (!head.length || !/^\|?\s*[-:| ]+\s*$/.test(sep)) return null;
    const body = rows.slice(2).map(row => row.split('|').map(s => s.trim()).filter((_, i) => i < head.length));
    return `<table><thead><tr>${head.map(cell => `<th>${formatInline(cell)}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${head.map((_, idx) => `<td>${formatInline(row[idx] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function renderRichText(markdown) {
    const input = String(markdown || '').trim();
    if (!input) {
      return '<p>Aucun résultat disponible.</p>';
    }

    const lines = input.replace(/\r/g, '').split('\n');
    let html = '';
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i += 1;
        continue;
      }

      if (/^\|.+\|$/.test(trimmed) && i + 1 < lines.length) {
        const tableLines = [];
        while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
          tableLines.push(lines[i]);
          i += 1;
        }
        const tableHtml = renderMarkdownTable(tableLines);
        if (tableHtml) {
          html += tableHtml;
          continue;
        }
      }

      if (/^###\s+/.test(trimmed)) {
        html += `<h3>${formatInline(trimmed.replace(/^###\s+/, ''))}</h3>`;
        i += 1;
        continue;
      }
      if (/^##\s+/.test(trimmed)) {
        html += `<h2>${formatInline(trimmed.replace(/^##\s+/, ''))}</h2>`;
        i += 1;
        continue;
      }
      if (/^#\s+/.test(trimmed)) {
        html += `<h1>${formatInline(trimmed.replace(/^#\s+/, ''))}</h1>`;
        i += 1;
        continue;
      }
      if (/^-\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^-\s+/, ''));
          i += 1;
        }
        html += `<ul>${items.map(item => `<li>${formatInline(item)}</li>`).join('')}</ul>`;
        continue;
      }

      const paragraph = [];
      while (i < lines.length && lines[i].trim() && !/^#{1,3}\s+/.test(lines[i].trim()) && !/^-\s+/.test(lines[i].trim()) && !/^\|.+\|$/.test(lines[i].trim())) {
        paragraph.push(lines[i].trim());
        i += 1;
      }
      html += `<p>${formatInline(paragraph.join(' '))}</p>`;
    }

    return html;
  }

  function mockGeneration(text) {
    return `## Note stratégique\n\n**Objet** : ${text || 'Besoin à préciser'}\n\n### Enjeux\n- Sécuriser le cadre d'analyse\n- Structurer la prise de décision\n- Préparer une restitution exploitable\n\n### Points d'attention\n| Axe | Observation |\n| --- | --- |\n| Fond | Clarifier les faits, le contexte et le calendrier |\n| Forme | Prévoir un rendu directement mobilisable |\n| Suite | Identifier si une relecture experte est utile |\n\n### Proposition\nUn premier draft structuré est produit pour permettre une exploitation rapide, puis une montée en gamme peut être engagée selon le niveau d'enjeu.`;
  }

  function setLoading(isLoading) {
    generateBtn.disabled = isLoading;
    loadingIndicator.hidden = !isLoading;
    generateBtn.classList.toggle('is-busy', isLoading);
  }

  function renderResult(rawText) {
    resultEl.classList.remove('empty-state');
    resultEl.innerHTML = renderRichText(rawText);
  }

  function renderArchives() {
    if (!window.ArchiveStore || !window.ArchiveStore.isAvailable()) {
      archiveList.innerHTML = '<div class="archive-empty">Archivage local indisponible sur cet appareil.</div>';
      return;
    }

    const query = (archiveSearch.value || '').trim().toLowerCase();
    const items = window.ArchiveStore.list().filter(item => {
      if (!query) return true;
      return `${item.title} ${item.prompt} ${item.result}`.toLowerCase().includes(query);
    });

    if (!items.length) {
      archiveList.innerHTML = '<div class="archive-empty">Aucune archive pour le moment. Les résultats archivés apparaîtront ici.</div>';
      return;
    }

    archiveList.innerHTML = items.map(item => `
      <article class="archive-card">
        <div class="archive-card-head">
          <h3>${escapeHtml(item.title)}</h3>
          <span>${new Date(item.createdAt).toLocaleString('fr-FR')}</span>
        </div>
        <p>${escapeHtml((item.prompt || '').slice(0, 140) || 'Aucun contexte enregistré.')}</p>
        <div class="archive-card-actions">
          <button type="button" data-action="open" data-id="${item.id}">Ouvrir</button>
          <button type="button" data-action="delete" data-id="${item.id}">Supprimer</button>
        </div>
      </article>`).join('');
    }

  function archiveCurrent() {
    if (!lastGeneration || !window.ArchiveStore || !window.ArchiveStore.isAvailable()) return;
    window.ArchiveStore.save({
      title: 'Livrable sécurisé',
      prompt: promptField.value.trim(),
      result: lastGeneration,
      createdAt: new Date().toISOString()
    });
    renderArchives();
  }

  generateBtn.addEventListener('click', async () => {
    const prompt = promptField.value.trim();
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 900));
      const output = mockGeneration(prompt);
      lastGeneration = output;
      renderResult(output);
      if (window.ArchiveStore && window.ArchiveStore.autoEnabled()) {
        archiveCurrent();
      }
    } finally {
      setLoading(false);
    }
  });

  archiveBtn.addEventListener('click', archiveCurrent);

  autoArchiveToggle.addEventListener('change', () => {
    if (window.ArchiveStore && window.ArchiveStore.isAvailable()) {
      window.ArchiveStore.setAuto(autoArchiveToggle.checked);
    } else {
      autoArchiveToggle.checked = false;
    }
  });

  archiveSearch.addEventListener('input', renderArchives);

  archiveList.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn || !window.ArchiveStore) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'delete') {
      window.ArchiveStore.remove(id);
      renderArchives();
      return;
    }
    if (btn.dataset.action === 'open') {
      const item = window.ArchiveStore.list().find(row => row.id === id);
      if (!item) return;
      promptField.value = item.prompt || '';
      lastGeneration = item.result || '';
      renderResult(item.result || '');
      window.scrollTo({ top: resultEl.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    }
  });

  copyResultBtn.addEventListener('click', async () => {
    if (!lastGeneration) return;
    try {
      await navigator.clipboard.writeText(lastGeneration);
      copyResultBtn.textContent = 'Copié';
      setTimeout(() => { copyResultBtn.textContent = 'Copier'; }, 1200);
    } catch {}
  });

  downloadResultBtn.addEventListener('click', () => {
    if (!lastGeneration) return;
    const blob = new Blob([lastGeneration], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pope-online-livrable-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  exportArchivesBtn.addEventListener('click', () => {
    if (!window.ArchiveStore || !window.ArchiveStore.isAvailable()) return;
    const blob = new Blob([window.ArchiveStore.exportAll()], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pope-online-archives-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  clearArchivesBtn.addEventListener('click', () => {
    if (!window.ArchiveStore || !window.ArchiveStore.isAvailable()) return;
    if (confirm('Supprimer toutes les archives locales ?')) {
      window.ArchiveStore.clear();
      renderArchives();
    }
  });

  autoArchiveToggle.checked = !!(window.ArchiveStore && window.ArchiveStore.autoEnabled && window.ArchiveStore.autoEnabled());
  if (!window.ArchiveStore || !window.ArchiveStore.isAvailable()) {
    autoArchiveToggle.disabled = true;
    archiveBtn.disabled = true;
  }
  setLoading(false);
  renderArchives();
})();
