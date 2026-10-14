// ============================================================================
// POPE Online V89.3 — « Parler à un conseiller » : même prise de rendez-vous que
// le diagnostic flash (prochaine disponibilité, calendrier, fuseau horaire,
// appel ou visio, récapitulatif, confirmation avec ajout à l'agenda).
// Se greffe sur la fenêtre de contact existante (#ctForm) des pages publiques,
// sans toucher à son envoi : le créneau choisi alimente le champ « slot ».
// Ajoute aussi les contrôles anti-abus (délai de saisie, Turnstile si configuré)
// au formulaire de contact et au formulaire de devis.
// ============================================================================
import { mountBooking, calendarLinks } from './booking.js';
import { mountTurnstile, getTurnstileToken, resetTurnstile } from './turnstile.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Délai de saisie : heure de première interaction avec chaque formulaire
function trackElapsed(form) {
  if (!form || form.dataset.elapsed) return;
  form.dataset.elapsed = '1';
  let first = 0;
  const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'elapsed_ms'; form.appendChild(hidden);
  const mark = () => { if (!first) first = Date.now(); };
  form.addEventListener('focusin', mark); form.addEventListener('pointerdown', mark);
  form.addEventListener('submit', () => { hidden.value = String(first ? Date.now() - first : 0); }, true);
  form.addEventListener('reset', () => { first = 0; });
}

function hidden(form, name) {
  let el = form.querySelector(`input[type=hidden][name="${name}"]`);
  if (!el) { el = document.createElement('input'); el.type = 'hidden'; el.name = name; form.appendChild(el); }
  return el;
}

function init() {
  trackElapsed(document.getElementById('dvForm'));
  const form = document.getElementById('ctForm');
  if (!form || form.dataset.bk) return;
  form.dataset.bk = '1';
  trackElapsed(form);

  const slotInput = form.querySelector('[name=slot]');
  const subject = document.getElementById('ctSubject');
  const msg = document.getElementById('ctMsg');
  const modal = form.closest('.s-modal');
  if (modal) modal.classList.add('ct-has-bk');
  if (!slotInput || !subject) return;

  // Le champ texte « Créneau souhaité » devient un champ caché alimenté par le calendrier
  const oldLabel = slotInput.closest('label');
  const slotHidden = hidden(form, 'slot');
  if (oldLabel) oldLabel.remove(); else slotInput.remove();
  const slotAt = hidden(form, 'slot_at'), tz = hidden(form, 'timezone'), mode = hidden(form, 'contact_mode'), tsTok = hidden(form, 'turnstileToken');

  const wrap = document.createElement('div');
  wrap.className = 'ct-bk s-field-full';
  wrap.innerHTML = `<ol class="ct-bk-steps" aria-hidden="true"><li class="is-on">Créneau</li><li>Coordonnées</li><li>Confirmation</li></ol><div class="ct-bk-host"></div>`;
  const subjLabel = subject.closest('label');
  subjLabel.insertAdjacentElement('afterend', wrap);
  const steps = wrap.querySelectorAll('.ct-bk-steps li');
  const setStep = (n) => steps.forEach((li, i) => li.classList.toggle('is-on', i <= n));

  // Indications « requis » sur l'e-mail et le téléphone
  const req = (name, txt) => {
    const lab = form.querySelector(`[name=${name}]`)?.closest('label'); if (!lab) return null;
    const sp = document.createElement('span'); sp.className = 'ct-req'; sp.textContent = txt; sp.hidden = true;
    lab.insertBefore(sp, lab.querySelector('input')); return sp;
  };
  const reqPhone = req('phone', ' (requis pour un appel)');
  const reqEmail = req('email', ' (requis pour la visio)');

  // Turnstile (case anti-robot) si la clé du site est configurée
  const ts = document.createElement('div'); ts.id = 'ctTurnstile'; ts.className = 's-field-full'; ts.hidden = true;
  const actions = form.querySelector('.s-form-actions'); form.insertBefore(ts, actions);
  let tsMounted = false;
  const ensureTs = () => { if (!tsMounted) { tsMounted = true; mountTurnstile('ctTurnstile').catch(() => {}); } };

  let slot = null;
  const subjToMode = (v) => (v === 'visio' ? 'visio' : 'phone');
  const needsSlot = () => subject.value === 'rappel' || subject.value === 'visio';
  const widget = mountBooking(wrap.querySelector('.ct-bk-host'), {
    mode: subjToMode(subject.value),
    onChange(detail, m) {
      slot = detail;
      slotHidden.value = detail ? detail.human : ''; slotAt.value = detail ? detail.iso : ''; tz.value = detail ? detail.tz : '';
      mode.value = needsSlot() ? m : '';
      if (needsSlot() && subject.value !== (m === 'visio' ? 'visio' : 'rappel')) subject.value = m === 'visio' ? 'visio' : 'rappel';
      if (reqPhone) reqPhone.hidden = !(needsSlot() && m === 'phone');
      if (reqEmail) reqEmail.hidden = !(needsSlot() && m === 'visio');
      setStep(detail ? 1 : 0);
    },
  });
  const syncSubject = () => {
    const show = needsSlot();
    wrap.hidden = !show;
    if (show) widget.setMode(subjToMode(subject.value));
    else { mode.value = ''; if (reqPhone) reqPhone.hidden = true; if (reqEmail) reqEmail.hidden = true; }
  };
  subject.addEventListener('change', syncSubject);

  // Ouverture de la fenêtre : rétablir le formulaire si une confirmation était affichée
  const done = document.createElement('div'); done.className = 'bk-done'; done.hidden = true;
  form.insertAdjacentElement('afterend', done);
  const showForm = () => { done.hidden = true; form.hidden = false; };
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-contact]')) setTimeout(() => { showForm(); syncSubject(); ensureTs(); }, 0);
  });
  if (document.getElementById('ctBack')?.classList.contains('open')) { syncSubject(); ensureTs(); }
  syncSubject();

  // Contrôles avant l'envoi géré par la page (phase de capture)
  let pending = null;
  form.addEventListener('submit', (e) => {
    const err = (t) => { e.preventDefault(); e.stopImmediatePropagation(); msg.textContent = t; msg.className = 's-form-msg err'; };
    const v = (n) => String(form.querySelector(`[name=${n}]`)?.value || '').trim();
    tsTok.value = getTurnstileToken();
    pending = null;
    if (!needsSlot()) return;
    if (!slot) return err('Choisissez un créneau dans le calendrier (ou « Prochaine disponibilité »).');
    if (!v('name')) return err('Indiquez votre nom.');
    if (widget.mode === 'phone' && !v('phone')) return err('Indiquez le numéro auquel le conseiller doit vous appeler.');
    if (widget.mode === 'visio' && !v('email')) return err('Indiquez votre e-mail : le lien de visioconférence vous y sera envoyé.');
    pending = { ...slot, mode: widget.mode };
  }, true);

  // La page vide le formulaire (form.reset) après un envoi réussi : on affiche alors la confirmation
  form.addEventListener('reset', () => {
    resetTurnstile();
    const p = pending; pending = null;
    setTimeout(() => {
      widget.reset(); syncSubject();
      if (!p || !String(msg.className).includes('ok')) return;
      const how = p.mode === 'visio' ? 'Visioconférence' : 'Appel téléphonique';
      const links = calendarLinks({ iso: p.iso, durationMin: p.durationMin, title: `Pope Online — ${how} avec un conseiller`,
        details: 'Rendez-vous demandé avec un conseiller Pope Online. Il vous confirme ce créneau. En cas d\'empêchement : 09 70 70 30 55.' });
      done.innerHTML = `<div class="bk-done-ico" aria-hidden="true"><svg viewBox="0 0 52 52" width="52" height="52"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 27l7 7 15-16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h3>Rendez-vous demandé</h3>
        <p class="bk-done-when"><strong>${esc(p.dayLabel)} à ${esc(p.timeLabel)}</strong><br>${esc(how)} · ${p.durationMin} min · ${esc(p.tzLabel)}</p>
        <p>Un conseiller vous confirme ce créneau par e-mail ou par SMS.${p.mode === 'visio' ? ' Le lien de visioconférence vous sera envoyé par e-mail.' : ''}</p>
        <div class="bk-done-actions"><a class="s-btn s-btn-ghost s-btn-sm" href="${links.icsUrl}" download="rendez-vous-pope-online.ics">Ajouter à mon agenda (.ics)</a>
          <a class="s-btn s-btn-ghost s-btn-sm" href="${links.googleUrl}" target="_blank" rel="noopener">Google Agenda</a></div>`;
      form.hidden = true; done.hidden = false; setStep(2);
      done.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
