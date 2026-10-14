// ============================================================================
// POPE Online V89.5 — Fenêtre « Parler à un conseiller »
// Mise en page à deux volets, à l'image de la page de connexion (volet sapin avec
// la photo et les engagements, formulaire à droite), un seul choix « comment
// échanger » (appel, visio ou question écrite) et la prise de rendez-vous du
// diagnostic flash. Se greffe sur la fenêtre existante (#ctForm) des pages
// publiques sans toucher à son envoi : le créneau choisi alimente le champ « slot ».
// Ajoute aussi les contrôles anti-abus (délai de saisie, Turnstile si configuré)
// au formulaire de contact et au formulaire de devis.
// ============================================================================
import { mountBooking, calendarLinks } from './booking.js';
import { mountTurnstile, getTurnstileToken, resetTurnstile } from './turnstile.js';
import logoUrl from './assets/popeoline-logo-ligne.png';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = window.POPE_SITE || {};
const PHONE = (S.phone && S.phone.display) || '09 70 70 30 55';
const PHONE_HREF = (S.phone && S.phone.href) || 'tel:+33970703055';

const ICON = {
  phone: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor"/>',
  visio: '<rect x="3" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15 10l6-3v10l-6-3z" fill="currentColor"/>',
  question: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 6l8.5 7 8.5-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};
const svg = (k, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true" focusable="false">${ICON[k]}</svg>`;

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

// Volet de gauche et en-tête, à l'image de la page de connexion
function buildLayout(modal, form) {
  modal.classList.add('ct-has-bk', 'ct-split');
  const close = modal.querySelector('.s-modal-close');
  const title = modal.querySelector('#ctTitle');
  const intro = title && title.nextElementSibling && title.nextElementSibling.tagName === 'P' ? title.nextElementSibling : null;
  const main = document.createElement('div'); main.className = 'ct-main';
  const aside = document.createElement('aside'); aside.className = 'ct-aside';
  aside.innerHTML = `
    <div class="ct-aside-in">
      <img class="ct-aside-logo" src="${logoUrl}" alt="Pope Online" width="174" height="35"/>
      <p class="ct-aside-title">Un conseiller, au moment qui vous arrange</p>
      <ul class="ct-aside-list">
        <li>${svg('check', 16)}<span>15 minutes, gratuit et sans engagement</span></li>
        <li>${svg('check', 16)}<span>Un interlocuteur qui connaît les collectivités</span></li>
        <li>${svg('check', 16)}<span>Créneaux à votre heure, Hexagone et outre-mer</span></li>
      </ul>
      <p class="ct-aside-phone">Vous préférez appeler&nbsp;?<a href="${PHONE_HREF}">${svg('phone', 16)}<span class="ct-nowrap">${esc(PHONE)}</span></a></p>
      <p class="ct-aside-devis">Commune ou collectivité&nbsp;: <a href="#devis" data-devis="commune">demander un devis</a></p>
    </div>`;
  aside.querySelector('[data-devis]').addEventListener('click', () => { const b = document.getElementById('ctBack'); if (b) { b.classList.remove('open'); b.setAttribute('aria-hidden', 'true'); } });
  [...modal.children].forEach((c) => { if (c !== close) main.appendChild(c); });
  modal.append(aside, main);
  if (intro) intro.remove();
  const sub = document.createElement('p'); sub.className = 'ct-sub'; sub.textContent = 'Choisissez comment échanger, puis votre créneau.';
  if (title) title.insertAdjacentElement('afterend', sub);
  return main;
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
  if (!slotInput || !subject || !modal) return;
  buildLayout(modal, form);

  // Le menu « Votre demande » devient un choix unique en trois cartes
  const subjLabel = subject.closest('label');
  subjLabel.classList.add('ct-subject-hidden');
  const choice = document.createElement('div');
  choice.className = 'ct-choice s-field-full'; choice.setAttribute('role', 'radiogroup'); choice.setAttribute('aria-label', 'Comment souhaitez-vous échanger ?');
  const OPTS = [['rappel', 'phone', 'Être rappelé', 'Par téléphone'], ['visio', 'visio', 'Visioconférence', 'Lien envoyé par e-mail'], ['question', 'question', 'Question écrite', 'Réponse par e-mail']];
  choice.innerHTML = OPTS.map(([v, ic, t, d]) => `<button type="button" role="radio" class="ct-opt" data-subject="${v}" aria-checked="false"><span class="ct-opt-ico">${svg(ic, 20)}</span><span class="ct-opt-t">${t}</span><span class="ct-opt-d">${d}</span></button>`).join('');
  subjLabel.insertAdjacentElement('afterend', choice);

  // Le champ texte « Créneau souhaité » devient un champ caché alimenté par le calendrier
  const oldLabel = slotInput.closest('label');
  const slotHidden = hidden(form, 'slot');
  if (oldLabel) oldLabel.remove(); else slotInput.remove();
  const slotAt = hidden(form, 'slot_at'), tz = hidden(form, 'timezone'), mode = hidden(form, 'contact_mode'), tsTok = hidden(form, 'turnstileToken');

  const wrap = document.createElement('div');
  wrap.className = 'ct-bk s-field-full';
  wrap.innerHTML = `<ol class="ct-bk-steps" aria-hidden="true"><li class="is-on">Créneau</li><li>Coordonnées</li><li>Confirmation</li></ol><div class="ct-bk-host"></div>`;
  choice.insertAdjacentElement('afterend', wrap);
  const steps = wrap.querySelectorAll('.ct-bk-steps li');
  const setStep = (n) => steps.forEach((li, i) => li.classList.toggle('is-on', i <= n));

  // Indications « requis » sur l'e-mail et le téléphone
  const req = (name, txt) => {
    const lab = form.querySelector(`[name=${name}]`)?.closest('label'); if (!lab) return null;
    const sp = document.createElement('span'); sp.className = 'ct-req'; sp.textContent = txt; sp.hidden = true;
    lab.insertBefore(sp, lab.querySelector('input')); return sp;
  };
  const reqPhone = req('phone', ' (requis pour un appel)');
  const reqEmail = req('email', ' (requis)');
  const msgLabel = form.querySelector('[name=message]')?.closest('label');

  // Turnstile (case anti-robot) si la clé du site est configurée
  const ts = document.createElement('div'); ts.id = 'ctTurnstile'; ts.className = 's-field-full'; ts.hidden = true;
  const actions = form.querySelector('.s-form-actions'); form.insertBefore(ts, actions);
  const submit = document.getElementById('ctSubmit');
  let tsMounted = false;
  const ensureTs = () => { if (!tsMounted) { tsMounted = true; mountTurnstile('ctTurnstile').catch(() => {}); } };

  let slot = null;
  const needsSlot = () => subject.value === 'rappel' || subject.value === 'visio';
  const widget = mountBooking(wrap.querySelector('.ct-bk-host'), {
    mode: subject.value === 'visio' ? 'visio' : 'phone', showMode: false,
    onChange(detail) {
      slot = detail;
      slotHidden.value = detail ? detail.human : ''; slotAt.value = detail ? detail.iso : ''; tz.value = detail ? detail.tz : '';
      setStep(detail ? 1 : 0);
    },
  });
  const sync = () => {
    const v = subject.value;
    choice.querySelectorAll('.ct-opt').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.subject === v)));
    const show = needsSlot();
    wrap.hidden = !show;
    mode.value = show ? (v === 'visio' ? 'visio' : 'phone') : '';
    if (show) widget.setMode(v === 'visio' ? 'visio' : 'phone');
    if (reqPhone) reqPhone.hidden = v !== 'rappel';
    if (reqEmail) reqEmail.hidden = v === 'rappel';
    if (msgLabel) msgLabel.firstChild.nodeValue = v === 'question' ? 'Votre question' : 'Message (facultatif)';
    if (submit && !submit.disabled) submit.textContent = v === 'question' ? 'Envoyer ma question' : 'Confirmer mon rendez-vous';
  };
  choice.addEventListener('click', (e) => {
    const b = e.target.closest('.ct-opt'); if (!b) return;
    subject.value = b.dataset.subject; subject.dispatchEvent(new Event('change', { bubbles: true }));
  });
  subject.addEventListener('change', sync);

  // Confirmation après envoi ; réouverture de la fenêtre
  const done = document.createElement('div'); done.className = 'bk-done'; done.hidden = true;
  form.insertAdjacentElement('afterend', done);
  const showForm = () => { done.hidden = true; form.hidden = false; };
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-contact]')) setTimeout(() => { showForm(); sync(); ensureTs(); }, 0);
  });
  if (document.getElementById('ctBack')?.classList.contains('open')) ensureTs();
  sync();
  // Le libellé du bouton est rétabli par la page après l'envoi : on le garde cohérent
  new MutationObserver(() => { if (!submit.disabled) { const want = subject.value === 'question' ? 'Envoyer ma question' : 'Confirmer mon rendez-vous'; if (submit.textContent !== want) submit.textContent = want; } })
    .observe(submit, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

  // Contrôles avant l'envoi géré par la page (phase de capture)
  let pending = null;
  form.addEventListener('submit', (e) => {
    const err = (t) => { e.preventDefault(); e.stopImmediatePropagation(); msg.textContent = t; msg.className = 's-form-msg err'; };
    const v = (n) => String(form.querySelector(`[name=${n}]`)?.value || '').trim();
    tsTok.value = getTurnstileToken();
    pending = null;
    if (!v('name')) return err('Indiquez votre nom.');
    if (!needsSlot()) {
      if (!v('email')) return err('Indiquez votre e-mail : la réponse vous y sera envoyée.');
      if (!v('message')) return err('Écrivez votre question.');
      return;
    }
    if (!slot) return err('Choisissez un créneau dans le calendrier, ou « Prochaine disponibilité ».');
    if (subject.value === 'rappel' && !v('phone')) return err('Indiquez le numéro auquel le conseiller doit vous appeler.');
    if (subject.value === 'visio' && !v('email')) return err('Indiquez votre e-mail : le lien de visioconférence vous y sera envoyé.');
    pending = { ...slot, mode: subject.value === 'visio' ? 'visio' : 'phone' };
  }, true);

  // La page vide le formulaire (form.reset) après un envoi réussi : on affiche alors la confirmation
  form.addEventListener('reset', () => {
    resetTurnstile();
    const p = pending; pending = null;
    const subj = subject.value;
    setTimeout(() => {
      subject.value = subj; widget.reset(); sync();
      if (!String(msg.className).includes('ok')) return;
      if (!p) {
        done.innerHTML = `<div class="bk-done-ico" aria-hidden="true"><svg viewBox="0 0 52 52" width="52" height="52"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 27l7 7 15-16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <h3>Question envoyée</h3><p>Un conseiller vous répond par e-mail sous un jour ouvré.</p>`;
      } else {
        const how = p.mode === 'visio' ? 'Visioconférence' : 'Appel téléphonique';
        const links = calendarLinks({ iso: p.iso, durationMin: p.durationMin, title: `Pope Online — ${how} avec un conseiller`,
          details: `Rendez-vous demandé avec un conseiller Pope Online. Il vous confirme ce créneau. En cas d'empêchement : ${PHONE}.` });
        done.innerHTML = `<div class="bk-done-ico" aria-hidden="true"><svg viewBox="0 0 52 52" width="52" height="52"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 27l7 7 15-16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <h3>Rendez-vous demandé</h3>
          <p class="bk-done-when"><strong>${esc(p.dayLabel)} à ${esc(p.timeLabel)}</strong><br>${esc(how)} · ${p.durationMin} min · ${esc(p.tzLabel)}</p>
          <p>Un conseiller vous confirme ce créneau par e-mail ou par SMS.${p.mode === 'visio' ? ' Le lien de visioconférence vous sera envoyé par e-mail.' : ''}</p>
          <div class="bk-done-actions"><a class="s-btn s-btn-ghost s-btn-sm" href="${links.icsUrl}" download="rendez-vous-pope-online.ics">Ajouter à mon agenda (.ics)</a>
            <a class="s-btn s-btn-ghost s-btn-sm" href="${links.googleUrl}" target="_blank" rel="noopener">Google Agenda</a></div>`;
      }
      form.hidden = true; done.hidden = false;
      done.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
