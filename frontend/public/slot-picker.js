/* POPE Online — sélecteur de créneau de rappel : jours ouvrés, 9 h – 18 h, heure de l'Hexagone (Paris). */
(function () {
  var TZ = 'Europe/Paris', DAYS = 10, FIRST = 9 * 60, LAST = 17 * 60 + 30, STEP = 30;
  function parts(date, tz, opts) {
    var o = {}; new Intl.DateTimeFormat('fr-FR', Object.assign({ timeZone: tz }, opts)).formatToParts(date).forEach(function (p) { o[p.type] = p.value; }); return o;
  }
  function parisNowParts(d) { var p = parts(d, TZ, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); return { y: +p.year, m: +p.month, d: +p.day, h: (+p.hour) % 24, min: +p.minute }; }
  // instant UTC correspondant à une heure « murale » de Paris
  function parisToDate(y, m, d, h, min) {
    var guess = Date.UTC(y, m - 1, d, h, min);
    for (var i = 0; i < 2; i++) {
      var q = parisNowParts(new Date(guess));
      var asUtc = Date.UTC(q.y, q.m - 1, q.d, q.h, q.min);
      guess += Date.UTC(y, m - 1, d, h, min) - asUtc;
    }
    return new Date(guess);
  }
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function hm(min) { return Math.floor(min / 60) + ' h ' + two(min % 60); }
  function businessDays() {
    var now = new Date(), out = [], base = parisNowParts(now), cur = new Date(Date.UTC(base.y, base.m - 1, base.d, 12));
    while (out.length < DAYS) {
      var wd = cur.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push({ y: cur.getUTCFullYear(), m: cur.getUTCMonth() + 1, d: cur.getUTCDate(), date: new Date(cur) });
      cur = new Date(cur.getTime() + 86400000);
    }
    return out;
  }
  function init() {
    var input = document.querySelector('#ctForm input[name=slot]');
    if (!input || input.dataset.picker) return;
    input.dataset.picker = '1'; input.type = 'hidden';
    var label = input.closest('label'); if (label) label.removeAttribute('for');
    var box = document.createElement('div');
    box.className = 's-slots';
    box.innerHTML = '<div class="s-slots-title">Créneau souhaité</div>' +
      '<p class="s-slots-note">Cliquez sur un jour puis sur une heure. Horaires d’ouverture : du lundi au vendredi, 9 h – 18 h, <strong>heure de l’Hexagone (Paris)</strong>.</p>' +
      '<div class="s-slots-days" role="group" aria-label="Jour"></div>' +
      '<div class="s-slots-times" role="group" aria-label="Heure"></div>' +
      '<p class="s-slots-sel" role="status" aria-live="polite"></p>';
    (label || input).parentNode.insertBefore(box, label || input);
    if (label) { label.style.display = 'none'; }
    var daysEl = box.querySelector('.s-slots-days'), timesEl = box.querySelector('.s-slots-times'), selEl = box.querySelector('.s-slots-sel');
    var days = businessDays(), curDay = null, curTime = null;
    var dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    var longFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    daysEl.innerHTML = days.map(function (x, i) { return '<button type="button" class="s-slot-day" data-i="' + i + '" aria-pressed="false">' + dayFmt.format(x.date).replace('.', '') + '</button>'; }).join('');
    function renderTimes() {
      timesEl.innerHTML = '';
      if (curDay == null) { timesEl.innerHTML = '<span class="s-slots-hint">Choisissez d’abord un jour.</span>'; return; }
      var x = days[curDay], html = '', n = 0, limit = Date.now() + 60 * 60000; // au moins 1 h de préavis
      for (var t = FIRST; t <= LAST; t += STEP) {
        var at = parisToDate(x.y, x.m, x.d, Math.floor(t / 60), t % 60);
        var past = at.getTime() < limit;
        if (past) continue; n++;
        html += '<button type="button" class="s-slot-time" data-t="' + t + '" aria-pressed="' + (curTime === t) + '">' + hm(t) + '</button>';
      }
      timesEl.innerHTML = n ? html : '<span class="s-slots-hint">Plus de créneau ce jour : choisissez un autre jour.</span>';
    }
    function update() {
      daysEl.querySelectorAll('.s-slot-day').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.i === curDay)); });
      if (curDay == null || curTime == null) { input.value = ''; selEl.textContent = ''; return; }
      var x = days[curDay], when = longFmt.format(x.date) + ' à ' + hm(curTime) + ' (heure de Paris)';
      var at = parisToDate(x.y, x.m, x.d, Math.floor(curTime / 60), curTime % 60), local = '';
      try {
        var ltz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (ltz && parts(at, ltz, { hour: '2-digit', minute: '2-digit', hour12: false }).hour + ':' + parts(at, ltz, { minute: '2-digit' }).minute !== two(Math.floor(curTime / 60)) + ':' + two(curTime % 60)) {
          var lp = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: ltz }).format(at);
          local = ' — soit ' + lp.replace(':', ' h ') + ' chez vous';
        }
      } catch (e) {}
      input.value = when + local;
      selEl.textContent = '✓ ' + input.value;
    }
    daysEl.addEventListener('click', function (e) { var b = e.target.closest('.s-slot-day'); if (!b) return; curDay = +b.dataset.i; curTime = null; renderTimes(); update(); });
    timesEl.addEventListener('click', function (e) { var b = e.target.closest('.s-slot-time'); if (!b) return; curTime = +b.dataset.t; timesEl.querySelectorAll('.s-slot-time').forEach(function (k) { k.setAttribute('aria-pressed', String(k === b)); }); update(); });
    input.form.addEventListener('reset', function () { curDay = curTime = null; setTimeout(function () { renderTimes(); update(); }, 0); });
    renderTimes();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
