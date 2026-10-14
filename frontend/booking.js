// ============================================================================
// POPE Online V89.1 — Prise de rendez-vous de rappel (calendrier, fuseau, mode)
// Inspiré des agendas en ligne de référence : prochaine disponibilité en un clic,
// calendrier mensuel, créneaux dans l'heure locale de l'élu (outre-mer compris),
// choix téléphone ou visio, récapitulatif, ajout à l'agenda (.ics, Google).
//
// Il s'agit d'une DEMANDE de créneau : l'équipe la confirme par e-mail ou SMS.
// Réglages : window.POPE_SITE.callback (voir site-config.js).
// ============================================================================

const ZONES = [
  { tz: 'Europe/Paris', label: 'Hexagone et Corse' },
  { tz: 'America/Martinique', label: 'Guadeloupe, Martinique, Saint-Martin, Saint-Barthélemy' },
  { tz: 'America/Cayenne', label: 'Guyane' },
  { tz: 'Indian/Reunion', label: 'La Réunion' },
  { tz: 'Indian/Mayotte', label: 'Mayotte' },
  { tz: 'America/Miquelon', label: 'Saint-Pierre-et-Miquelon' },
  { tz: 'Pacific/Noumea', label: 'Nouvelle-Calédonie' },
  { tz: 'Pacific/Tahiti', label: 'Polynésie française' },
  { tz: 'Pacific/Wallis', label: 'Wallis-et-Futuna' },
];
// Fuseaux équivalents détectés par le navigateur → entrée de la liste
const ALIASES = { 'America/Guadeloupe': 'America/Martinique', 'America/Marigot': 'America/Martinique', 'America/St_Barthelemy': 'America/Martinique',
  'Europe/Monaco': 'Europe/Paris', 'Indian/Antananarivo': 'Indian/Mayotte', 'Indian/Comoro': 'Indian/Mayotte', 'Indian/Mauritius': 'Indian/Reunion' };

const DEF = { start: 8 * 60 + 30, end: 18 * 60, step: 30, lunch: [12 * 60, 13 * 60 + 30], horizonDays: 21, leadMinutes: 120, durationMin: 15 };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const two = (n) => String(n).padStart(2, '0');
const hm = (min) => `${Math.floor(min / 60)} h ${two(min % 60)}`;

function wall(date, tz) {               // heure « murale » d'un instant dans un fuseau
  const o = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
    .formatToParts(date).forEach((p) => { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, min: +o.minute, wd: o.weekday };
}
function zoned(y, m, d, h, min, tz) {   // instant correspondant à une heure murale d'un fuseau
  let guess = Date.UTC(y, m - 1, d, h, min);
  for (let i = 0; i < 3; i++) {
    const w = wall(new Date(guess), tz);
    guess += Date.UTC(y, m - 1, d, h, min) - Date.UTC(w.y, w.m - 1, w.d, w.h, w.min);
  }
  return new Date(guess);
}
const dayKey = (y, m, d) => `${y}-${two(m)}-${two(d)}`;

export function mountBooking(host, { onChange } = {}) {
  const cfg = Object.assign({}, DEF, (window.POPE_SITE && window.POPE_SITE.callback) || {});
  let tz = 'Europe/Paris';
  try { const det = Intl.DateTimeFormat().resolvedOptions().timeZone; const t = ALIASES[det] || det; if (ZONES.some((z) => z.tz === t)) tz = t; } catch (e) {}
  const state = { mode: 'phone', tz, day: null, time: null, month: null };

  // Jours ouvrés (dans le fuseau de l'élu) et créneaux disponibles
  function slotsFor(y, m, d) {
    const out = []; const limit = Date.now() + cfg.leadMinutes * 60000;
    for (let t = cfg.start; t < cfg.end; t += cfg.step) {
      if (cfg.lunch && t >= cfg.lunch[0] && t < cfg.lunch[1]) continue;
      const at = zoned(y, m, d, Math.floor(t / 60), t % 60, state.tz);
      if (at.getTime() >= limit) out.push({ t, at });
    }
    return out;
  }
  function availableDays() {
    const now = wall(new Date(), state.tz); const days = [];
    let cur = new Date(Date.UTC(now.y, now.m - 1, now.d, 12));
    for (let i = 0; i < 60 && days.length < cfg.horizonDays; i++) {
      const wd = cur.getUTCDay();
      if (wd !== 0 && wd !== 6) {
        const y = cur.getUTCFullYear(), m = cur.getUTCMonth() + 1, d = cur.getUTCDate();
        const s = slotsFor(y, m, d);
        if (s.length) days.push({ y, m, d, key: dayKey(y, m, d), slots: s });
      }
      cur = new Date(cur.getTime() + 86400000);
    }
    return days;
  }
  let days = availableDays();
  const first = days[0];
  state.month = first ? { y: first.y, m: first.m } : null;

  const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const fmtShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dUTC = (x) => new Date(Date.UTC(x.y, x.m - 1, x.d, 12));
  const zoneLabel = () => (ZONES.find((z) => z.tz === state.tz) || {}).label || state.tz;

  host.classList.add('bk');
  host.innerHTML = `
    <div class="bk-top">
      <div class="bk-mode" role="radiogroup" aria-label="Comment souhaitez-vous être contacté ?">
        <button type="button" role="radio" data-mode="phone" aria-checked="true"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor"/></svg>Appel téléphonique</button>
        <button type="button" role="radio" data-mode="visio" aria-checked="false"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 10l6-3v10l-6-3z" fill="currentColor"/></svg>Visioconférence</button>
      </div>
      <span class="bk-dur"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>${cfg.durationMin} min · gratuit, sans engagement</span>
    </div>
    <div class="bk-next"></div>
    <div class="bk-body">
      <div class="bk-cal">
        <div class="bk-cal-head"><button type="button" class="bk-nav" data-nav="-1" aria-label="Mois précédent">‹</button><strong class="bk-month" aria-live="polite"></strong><button type="button" class="bk-nav" data-nav="1" aria-label="Mois suivant">›</button></div>
        <div class="bk-dow" aria-hidden="true"><span>lun</span><span>mar</span><span>mer</span><span>jeu</span><span>ven</span><span>sam</span><span>dim</span></div>
        <div class="bk-grid" role="grid" aria-label="Choisissez un jour"></div>
      </div>
      <div class="bk-times">
        <label class="bk-tz">Votre fuseau horaire
          <select>${ZONES.map((z) => `<option value="${z.tz}">${esc(z.label)}</option>`).join('')}</select>
        </label>
        <div class="bk-slots" aria-live="polite"></div>
      </div>
    </div>
    <div class="bk-sum" hidden></div>`;

  const $ = (s) => host.querySelector(s);
  $('.bk-tz select').value = state.tz;

  function selected() {
    if (!state.day || state.time == null) return null;
    const x = days.find((d) => d.key === state.day); if (!x) return null;
    const s = x.slots.find((k) => k.t === state.time); if (!s) return null;
    return { x, s };
  }
  function emit() {
    const sel = selected();
    let detail = null;
    if (sel) {
      const p = wall(sel.s.at, 'Europe/Paris');
      const human = `${fmtLong.format(dUTC(sel.x))} à ${hm(sel.s.t)} (${zoneLabel()})` + (state.tz !== 'Europe/Paris' ? ` — soit ${p.h} h ${two(p.min)} à Paris` : '');
      detail = { iso: sel.s.at.toISOString(), human, tz: state.tz, tzLabel: zoneLabel(), mode: state.mode, durationMin: cfg.durationMin, dayLabel: fmtLong.format(dUTC(sel.x)), timeLabel: hm(sel.s.t) };
    }
    if (onChange) onChange(detail, state.mode);
  }
  function renderNext() {
    const f = days[0];
    $('.bk-next').innerHTML = f ? `<button type="button" class="bk-next-btn" data-day="${f.key}" data-t="${f.slots[0].t}">
        <span class="bk-pulse" aria-hidden="true"></span><span><small>Prochaine disponibilité</small><strong>${esc(fmtShort.format(dUTC(f)))} à ${hm(f.slots[0].t)}</strong></span><span class="bk-next-go">Choisir →</span></button>` : '';
  }
  function renderCal() {
    if (!state.month) { $('.bk-grid').innerHTML = '<p class="bk-empty">Aucun créneau disponible pour le moment.</p>'; return; }
    const { y, m } = state.month;
    $('.bk-month').textContent = fmtMonth.format(new Date(Date.UTC(y, m - 1, 1, 12)));
    const firstWd = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const nDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const avail = new Set(days.map((d) => d.key));
    const now = wall(new Date(), state.tz); const todayKey = dayKey(now.y, now.m, now.d);
    let html = '';
    for (let i = 0; i < firstWd; i++) html += '<span class="bk-day is-pad" aria-hidden="true"></span>';
    for (let d = 1; d <= nDays; d++) {
      const key = dayKey(y, m, d), ok = avail.has(key);
      const label = fmtLong.format(new Date(Date.UTC(y, m - 1, d, 12)));
      html += `<button type="button" class="bk-day${ok ? ' is-av' : ''}${key === todayKey ? ' is-today' : ''}" data-day="${key}" ${ok ? '' : 'disabled'} aria-pressed="${state.day === key}" aria-label="${esc(label)}${ok ? '' : ', indisponible'}">${d}</button>`;
    }
    $('.bk-grid').innerHTML = html;
    const months = [...new Set(days.map((d) => `${d.y}-${d.m}`))];
    const cur = `${y}-${m}`;
    $('[data-nav="-1"]').disabled = months.indexOf(cur) <= 0;
    $('[data-nav="1"]').disabled = months.indexOf(cur) === -1 || months.indexOf(cur) >= months.length - 1;
  }
  function renderSlots() {
    const box = $('.bk-slots');
    const x = days.find((d) => d.key === state.day);
    if (!x) { box.innerHTML = '<p class="bk-hint">Choisissez un jour dans le calendrier : les créneaux s\'affichent ici, dans votre heure locale.</p>'; return; }
    const parts = { Matin: [], 'Après-midi': [] };
    x.slots.forEach((s) => (s.t < 12 * 60 ? parts.Matin : parts['Après-midi']).push(s));
    box.innerHTML = `<p class="bk-day-title">${esc(fmtLong.format(dUTC(x)))}</p>` + Object.entries(parts).filter(([, v]) => v.length).map(([k, v]) =>
      `<div class="bk-part">${k}</div><div class="bk-slot-grid">${v.map((s) => `<button type="button" class="bk-slot" data-t="${s.t}" aria-pressed="${state.time === s.t}">${hm(s.t)}</button>`).join('')}</div>`).join('');
  }
  function renderSum() {
    const sel = selected(); const sum = $('.bk-sum');
    if (!sel) { sum.hidden = true; sum.innerHTML = ''; host.classList.remove('is-picked'); return; }
    host.classList.add('is-picked');
    const p = wall(sel.s.at, 'Europe/Paris');
    sum.hidden = false;
    sum.innerHTML = `<span class="bk-sum-ico" aria-hidden="true">✓</span>
      <div><strong>${state.mode === 'visio' ? 'Visioconférence' : 'Appel téléphonique'} · ${cfg.durationMin} min</strong>
      <span>${esc(fmtLong.format(dUTC(sel.x)))} à ${hm(sel.s.t)} <small>(${esc(zoneLabel())})</small></span>
      ${state.tz !== 'Europe/Paris' ? `<small>Soit ${p.h} h ${two(p.min)} à Paris</small>` : ''}</div>
      <button type="button" class="bk-edit">Modifier</button>`;
  }
  function renderAll() { renderNext(); renderCal(); renderSlots(); renderSum(); emit(); }

  host.addEventListener('click', (e) => {
    const mode = e.target.closest('[data-mode]');
    if (mode) { state.mode = mode.dataset.mode; host.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b === mode))); renderSum(); emit(); return; }
    const nav = e.target.closest('[data-nav]');
    if (nav && state.month) { let { y, m } = state.month; m += +nav.dataset.nav; if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; } state.month = { y, m }; renderCal(); return; }
    const nx = e.target.closest('.bk-next-btn');
    if (nx) { const f = days.find((d) => d.key === nx.dataset.day); state.day = f.key; state.time = +nx.dataset.t; state.month = { y: f.y, m: f.m }; renderCal(); renderSlots(); renderSum(); emit(); return; }
    const day = e.target.closest('.bk-day.is-av');
    if (day) { state.day = day.dataset.day; state.time = null; renderCal(); renderSlots(); renderSum(); emit(); const t = $('.bk-slots'); if (window.innerWidth < 720 && t) t.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    const slot = e.target.closest('.bk-slot');
    if (slot) { state.time = +slot.dataset.t; host.querySelectorAll('.bk-slot').forEach((b) => b.setAttribute('aria-pressed', String(b === slot))); renderSum(); emit(); return; }
    if (e.target.closest('.bk-edit')) { state.time = null; renderSlots(); renderSum(); emit(); }
  });
  $('.bk-tz select').addEventListener('change', (e) => {
    state.tz = e.target.value; state.day = null; state.time = null;
    days = availableDays(); const f = days[0]; state.month = f ? { y: f.y, m: f.m } : null; renderAll();
  });
  renderAll();
  return { reset() { state.day = null; state.time = null; renderAll(); }, get mode() { return state.mode; } };
}

// Fichier .ics et lien Google Agenda pour le créneau demandé
export function calendarLinks({ iso, durationMin = 15, title, details }) {
  const start = new Date(iso), end = new Date(start.getTime() + durationMin * 60000);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escIcs = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//POPE Online//Diagnostic flash//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@pope-online.com`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${escIcs(title)}`, `DESCRIPTION:${escIcs(details)}`, 'STATUS:TENTATIVE', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const icsUrl = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${f(start)}/${f(end)}&details=${encodeURIComponent(details)}`;
  return { icsUrl, googleUrl: g };
}
