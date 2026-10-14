// ============================================================================
// POPE Online V89.1 — Diagnostic flash (moteur et interface)
// L'élu répond à 8 questions courtes, en 2 minutes. Le diagnostic est calculé
// dans le navigateur : rien n'est envoyé tant que l'élu ne le demande pas
// (transmission à un expert, ou demande de rappel).
// V89.1 : « Ma situation est différente » dans chaque domaine, prise de
// rendez-vous moderne pour le rappel.
// V89.2 : ordre des questions de la V89 (profil d'abord), anti-abus du formulaire
// de rendez-vous (Turnstile si configuré, délai minimal de saisie).
// ============================================================================
import { PROFILES, SIZES, DOMAINS, SITUATIONS, TENSION, DEADLINES, STAKES, SCOPES, OTHER_SITUATION, GENERIC } from './diagnostic-tree.js';
import { mountBooking, calendarLinks } from './booking.js';
import { mountTurnstile, getTurnstileToken, resetTurnstile } from './turnstile.js';

const API = ((import.meta.env && import.meta.env.VITE_API_URL) || 'https://pope-online-v2.onrender.com').trim().replace(/\/$/, '');
export const DIAG_KEY = 'pope_diag_flash_v1';   // lu par dashboard.html pour pré-remplir la demande

const byId = (list, id) => list.find((x) => x.id === id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sitList = (domain) => (domain === 'autre' ? [] : [...(SITUATIONS[domain] || []), OTHER_SITUATION]);

// ─── Les questions, dans l'ordre de la V89 : qui vous êtes, puis le sujet ───
const STEPS = [
  { key: 'profile', title: 'Vous êtes…', options: () => PROFILES },
  { key: 'size', title: 'Votre collectivité compte…', options: () => SIZES },
  { key: 'domain', title: 'Votre sujet concerne…', options: () => DOMAINS },
  { key: 'situation', title: 'Plus précisément, votre situation est…', options: (a) => sitList(a.domain),
    hint: 'Les situations les plus fréquentes. Rien ne correspond ? Choisissez « Ma situation est différente » : un expert du domaine lira votre description.' },
  { key: 'tension', title: 'La situation a-t-elle déjà dégénéré ?', options: () => TENSION },
  { key: 'deadline', title: 'Quand devez-vous décider ou agir ?', options: () => DEADLINES },
  { key: 'stakes', title: 'Quels enjeux sont en cause ?', hint: 'Plusieurs réponses possibles.', multi: true, options: () => STAKES },
  { key: 'scope', title: 'Ce dont vous avez besoin, c\'est plutôt…', options: () => SCOPES },
  { key: 'text', title: 'En quelques mots, que se passe-t-il ?', hint: 'Facultatif. Ces lignes pré-rempliront votre demande ; n\'indiquez pas de nom de personne.', free: true },
];

// ─── Lecture des réponses : vigilance, orientation, points d'attention ─────
export function computeResult(a) {
  const dom = byId(DOMAINS, a.domain) || DOMAINS[DOMAINS.length - 1];
  const gen = GENERIC[dom.id] || GENERIC.autre;
  let sit = byId(SITUATIONS[a.domain] || [], a.situation);
  if (!sit) {   // « Ma situation est différente » ou domaine « Autre sujet »
    const txt = (a.sitText || '').trim();
    sit = { id: 'autre', w: 1, label: txt || OTHER_SITUATION.label, title: txt ? (txt.length > 90 ? txt.slice(0, 87).trimEnd() + '…' : txt.charAt(0).toUpperCase() + txt.slice(1)) : gen.title, q: gen.q, p: gen.p, custom: true };
  }
  const ten = byId(TENSION, a.tension) || TENSION[0];
  const dl = byId(DEADLINES, a.deadline) || DEADLINES[3];
  const scope = byId(SCOPES, a.scope) || SCOPES[0];
  const stakes = (a.stakes || []).map((id) => byId(STAKES, id)).filter(Boolean);

  const score = sit.w + ten.w + dl.w + Math.min(stakes.length, 3);
  const level = score >= 7 ? 'critique' : score >= 4 ? 'elevee' : 'moderee';
  const levelLabel = { critique: 'Critique', elevee: 'Élevée', moderee: 'Modérée' }[level];

  const complex = scope.id === 'accompagnement' || (stakes.length >= 3 && ten.w >= 3) ||
    (a.domain === 'orga' && sit.id !== 'pilotage');
  const path = complex ? 'surmesure' : 'conseil';
  const urgent = dl.id === '48h' && level !== 'moderee';

  const alerts = [];
  if (ten.id === 'recours') alerts.push('Un recours ou une mise en demeure est engagé : des délais de procédure s\'imposent. Selon le cas, l\'appui d\'un avocat sera nécessaire ; l\'expert vous aide à préparer le dossier à lui transmettre.');
  if (ten.id === 'public') alerts.push('La situation est exposée publiquement : traitez ensemble le fond et la parole publique, et évitez toute annonce avant d\'avoir sécurisé la décision.');
  if (dl.id === '48h') alerts.push('L\'échéance est très proche : indiquez-la dans votre demande. Si la décision doit être prise avant la réponse de l\'expert, demandez à être rappelé.');
  if (a.domain === 'rh' && (sit.id === 'disc' || sit.id === 'harc')) alerts.push('Sur une situation individuelle d\'agent, conservez une trace écrite de chaque étape et ne prenez aucune mesure avant d\'avoir vérifié la procédure.');
  if (a.domain === 'jur' && sit.id === 'probite') alerts.push('En cas de doute sur un intérêt personnel, l\'élu concerné ne doit ni participer à la préparation de la décision ni prendre part au vote.');
  if (sit.custom) alerts.push('Votre situation sort des cas les plus fréquents : c\'est précisément là qu\'un regard d\'expert est utile. Il partira de votre description.');

  const profile = byId(PROFILES, a.profile);
  const size = byId(SIZES, a.size);
  const pieces = [...sit.p, 'Toute décision ou tout courrier déjà échangé sur le sujet'];
  const summary = `Vigilance ${levelLabel.toLowerCase()} · échéance : ${dl.label.toLowerCase()} · orientation : ${complex ? 'accompagnement sur mesure' : 'Conseil Expert'}.`;

  const need = {
    title: sit.title,
    context: [profile && profile.label, size && `collectivité de ${size.label.toLowerCase()}`].filter(Boolean).join(', ') + '.' + (a.text ? '\n' + a.text : ''),
    problem: `${sit.label}. ${ten.label}.`,
    objective: scope.objective,
    deadline: dl.id === 'aucune' ? '' : dl.label,
    risks: stakes.map((s) => s.label).join(' ; '),
    pieces: sit.p.join(', '),
    description: 'Demande préparée avec le diagnostic flash. Points à examiner : ' + sit.q.join(' ; ') + '.',
    treatment: path,
  };

  return { dom, sit, ten, dl, scope, stakes, score, level, levelLabel, path, urgent, alerts, pieces, summary, need };
}

// ─── Interface ──────────────────────────────────────────────────────────────
const root = document.getElementById('dgApp');
const answers = { stakes: [] };
let index = -1;            // -1 = écran d'accueil

// Lien avec un domaine (diagnostic.html?domaine=mp) : le domaine est présélectionné,
// le parcours commence normalement par l'écran d'accueil.
(function preselectFromUrl() {
  try {
    const d = new URLSearchParams(location.search).get('domaine');
    if (d && byId(DOMAINS, d)) answers.domain = d;
  } catch (e) {}
})();

const NQ = STEPS.filter((st) => st.key !== 'text').length;   // questions à choix (le champ libre est facultatif)

function isLoggedIn() {
  try { return localStorage.getItem('pope_session_active') === '1' || !!localStorage.getItem('pope_session_token') || !!sessionStorage.getItem('pope_session_token'); }
  catch (e) { return false; }
}

function progress() {
  const pct = Math.round((Math.max(index, 0) / STEPS.length) * 100);
  return `<div class="dg-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${STEPS.length}" aria-valuenow="${index + 1}" aria-label="Étape ${index + 1} sur ${STEPS.length}"><i style="width:${pct}%"></i></div>
    <p class="dg-count">${index + 1 > NQ ? 'Dernière étape, facultative' : `Question ${index + 1} sur ${NQ}`}<span>Environ ${Math.max(1, Math.round((STEPS.length - index) * 0.25))} min restante${(STEPS.length - index) * 0.25 >= 1.5 ? 's' : ''}</span></p>`;
}

function renderIntro() {
  root.innerHTML = `
    <div class="dg-card dg-intro">
      <h1 class="s-h1 dg-title">Faites le point sur votre situation avant d'agir</h1>
      <p class="s-lead">Huit questions courtes, et un champ libre facultatif, pour qualifier votre difficulté : vous obtenez un niveau de vigilance, les points qu'un expert examinera, les pièces à rassembler et la bonne façon d'être accompagné.</p>
      <ul class="dg-promises">
        <li>Gratuit et sans inscription</li>
        <li>Calculé sur votre appareil : rien n'est transmis sans votre accord</li>
        <li>Votre demande à l'expert est pré-remplie en un clic</li>
      </ul>
      <div class="s-actions"><button class="s-btn s-btn-primary" type="button" data-act="start">Commencer le diagnostic</button></div>
    </div>`;
}

function renderStep() {
  const st = STEPS[index];
  let body; let canNext; let nextLabel = 'Continuer';
  const textOnlySituation = st.key === 'situation' && answers.domain === 'autre';
  if (st.free || textOnlySituation) {
    const val = textOnlySituation ? (answers.sitText || '') : (answers.text || '');
    const ph = textOnlySituation ? 'Ex. : un administré conteste le tarif de l\'eau facturé par la commune.' : 'Ex. : le conseil se réunit jeudi ; nous devons voter une modification des tarifs et l\'opposition conteste la procédure.';
    body = `<label class="dg-free"><span class="s-sr">${esc(st.title)}</span>
      <textarea id="dgText" rows="5" maxlength="600" placeholder="${esc(ph)}">${esc(val)}</textarea></label>`;
    canNext = st.free || val.trim().length >= 5;
    if (st.free) nextLabel = 'Voir mon diagnostic';
  } else {
    const opts = st.options(answers);
    const isOther = st.key === 'situation' && answers.situation === 'autre';
    body = `<div class="dg-options${opts.length > 6 ? ' dg-options-2' : ''}" role="${st.multi ? 'group' : 'radiogroup'}" aria-label="${esc(st.title)}">` +
      opts.map((o) => {
        const sel = st.multi ? (answers.stakes || []).includes(o.id) : answers[st.key] === o.id;
        const other = o === OTHER_SITUATION;
        return `<button type="button" class="dg-opt${sel ? ' is-on' : ''}${other ? ' dg-opt-other' : ''}" ${st.multi ? `aria-pressed="${sel}"` : `role="radio" aria-checked="${sel}"`} data-opt="${esc(o.id)}">
          <span class="dg-opt-mark" aria-hidden="true"></span><span>${esc(o.label)}</span></button>`;
      }).join('') + '</div>' +
      (isOther ? `<label class="dg-free dg-other-text">Décrivez votre situation en une phrase
        <textarea id="dgText" rows="3" maxlength="300" placeholder="Ex. : un agent demande à cumuler son poste avec une activité privée.">${esc(answers.sitText || '')}</textarea></label>` : '');
    canNext = st.multi || (answers[st.key] && (!isOther || (answers.sitText || '').trim().length >= 5));
    if (st.multi && !(answers.stakes || []).length) nextLabel = 'Passer';
  }
  const manual = st.multi || st.free || textOnlySituation || (st.key === 'situation' && answers.situation === 'autre');
  root.innerHTML = `
    <div class="dg-card">
      ${progress()}
      <h2 class="dg-q" id="dgQ" tabindex="-1">${esc(textOnlySituation ? 'Décrivez votre situation en une phrase' : st.title)}</h2>
      ${st.hint && !textOnlySituation ? `<p class="dg-hint">${esc(st.hint)}</p>` : ''}
      ${textOnlySituation ? '<p class="dg-hint">Un expert du domaine concerné lira votre description.</p>' : ''}
      ${body}
      <div class="dg-nav">
        <button type="button" class="s-btn s-btn-ghost s-btn-sm" data-act="back">← Retour</button>
        ${manual || canNext ? `<button type="button" class="s-btn s-btn-primary s-btn-sm" data-act="next" ${canNext ? '' : 'disabled'}>${nextLabel} →</button>` : ''}
      </div>
    </div>`;
  const ta = document.getElementById('dgText');
  if (ta) {
    ta.addEventListener('input', () => {
      if (textOnlySituation || st.key === 'situation') answers.sitText = ta.value;
      const ok = st.free || ta.value.trim().length >= 5;
      const b = root.querySelector('[data-act=next]'); if (b) b.disabled = !ok;
    });
    if (st.key === 'situation') { ta.focus(); return; }
  }
  const q = document.getElementById('dgQ'); if (q) q.focus({ preventScroll: true });
}

function renderResult() {
  const r = computeResult(answers);
  try { localStorage.setItem(DIAG_KEY, JSON.stringify({ v: 1, at: Date.now(), domain: r.dom.domain, domainIcon: '🎯', need: r.need, level: r.level, profile: answers.profile || '', size: answers.size || '' })); } catch (e) {}
  const logged = isLoggedIn();
  const sendHref = logged ? 'dashboard.html?diag=1' : 'signup-public.html?from=diag';
  const delay = esc((window.POPE_SITE && window.POPE_SITE.responseDelay) || '24 h');
  const pathCard = r.path === 'surmesure'
    ? `<h3>Accompagnement sur mesure</h3><p>Votre situation dépasse une question ponctuelle : plusieurs enjeux, une durée ou une organisation à revoir. Nous vous proposons un échange avec un conseiller pour cadrer un accompagnement, par exemple un diagnostic approfondi suivi d'un plan d'action. Vous pouvez aussi poser dès maintenant votre question la plus urgente à un expert.</p>`
    : `<h3>Conseil Expert</h3><p>Votre besoin se prête à un Conseil Expert : un expert du domaine étudie votre dossier et vous répond par écrit sous ${delay} ouvrées, avec une réponse utilisable en séance.</p>`;
  root.innerHTML = `
    <div class="dg-card dg-result" id="dgResult">
      <p class="s-kicker">Votre diagnostic flash</p>
      <h2 class="s-h2 dg-res-title">${esc(r.sit.title)}</h2>
      <p class="dg-summary">${esc(r.summary)}</p>

      <div class="dg-level dg-level-${r.level}">
        <div class="dg-level-gauge" aria-hidden="true"><i></i><i></i><i></i></div>
        <div><span class="dg-level-k">Niveau de vigilance</span><strong>${r.levelLabel}</strong></div>
      </div>

      ${r.alerts.length ? `<div class="dg-alerts">${r.alerts.map((t) => `<p>${esc(t)}</p>`).join('')}</div>` : ''}

      <div class="dg-cols">
        <section><h3>Ce que l'expert examinera</h3><ul>${r.sit.q.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
        <section><h3>Pièces à rassembler</h3><ul class="dg-check">${r.pieces.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      </div>

      <div class="dg-path dg-path-${r.path}">
        <p class="dg-path-k">Notre recommandation</p>
        ${pathCard}
        <div class="s-actions">
          <a class="s-btn s-btn-primary" href="${sendHref}">${logged ? 'Transmettre à un expert' : 'Utiliser mon Conseil Expert offert'} →</a>
          <button class="s-btn s-btn-ghost" type="button" data-act="callback">${r.urgent || r.path === 'surmesure' ? 'Prendre rendez-vous rapidement' : 'Prendre rendez-vous avec un conseiller'}</button>
        </div>
        <p class="dg-path-note">${logged ? 'Votre demande sera pré-remplie avec ce diagnostic : il vous restera à la relire et à joindre vos pièces.' : 'Avec l\'essai gratuit de 15 jours, 2 Conseils Expert vous sont offerts, sans carte bancaire : votre première demande est déjà pré-remplie avec ce diagnostic.'}</p>
      </div>

      <section class="dg-callback" id="dgCallback" hidden>
        <div class="dg-cb-head">
          <h3>Prendre rendez-vous avec un conseiller</h3>
          <p>Choisissez le moment qui vous arrange : le conseiller vous appelle avec votre diagnostic sous les yeux.</p>
        </div>
        <ol class="dg-cb-steps" aria-hidden="true"><li class="is-on">Créneau</li><li>Coordonnées</li><li>Confirmation</li></ol>
        <div id="dgBooking"></div>
        <form class="s-form dg-cb-form" id="dgCbForm" novalidate>
          <label class="s-field">Nom et prénom<input name="name" autocomplete="name" required/></label>
          <label class="s-field">Collectivité<input name="organization" placeholder="Commune de…"/></label>
          <label class="s-field">Téléphone<span class="dg-req" data-req="phone"> (requis pour un appel)</span><input name="phone" type="tel" autocomplete="tel"/></label>
          <label class="s-field">E-mail<span class="dg-req" data-req="email" hidden> (requis pour la visio)</span><input name="email" type="email" autocomplete="email"/></label>
          <label class="s-field-full dg-consent"><input type="checkbox" name="consent" value="1"/> J'accepte que ce diagnostic et mes coordonnées soient transmis à l'équipe Pope Online pour être recontacté. <a href="privacy.html">Confidentialité</a></label>
          <input name="website" tabindex="-1" autocomplete="off" class="s-hp" aria-hidden="true"/>
          <div id="dgTurnstile" class="s-field-full" hidden></div>
          <p class="s-form-msg" id="dgCbMsg" role="status"></p>
          <div class="s-field-full s-form-actions"><button class="s-btn s-btn-primary" type="submit" id="dgCbSubmit">Confirmer mon rendez-vous</button>
            <span class="dg-cb-alt">Pas de créneau qui convient ? <a href="tel:+33970703055">09 70 70 30 55</a></span></div>
        </form>
        <div class="dg-cb-done" id="dgCbDone" hidden></div>
      </section>

      <div class="dg-foot">
        <button type="button" class="dg-link" data-act="print">Imprimer ou enregistrer en PDF</button>
        <button type="button" class="dg-link" data-act="restart">Refaire le diagnostic</button>
      </div>
      <p class="dg-disclaimer">Ce diagnostic est une première orientation, établie à partir de vos seules réponses. Il ne remplace pas l'analyse d'un expert sur pièces.</p>
    </div>`;
  const h = root.querySelector('.dg-res-title'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setupCallback(r);
}

function setupCallback(r) {
  const form = document.getElementById('dgCbForm');
  const steps = root.querySelectorAll('.dg-cb-steps li');
  let slot = null; let mode = 'phone';
  const setStep = (n) => steps.forEach((li, i) => li.classList.toggle('is-on', i <= n));
  mountBooking(document.getElementById('dgBooking'), {
    onChange(detail, m) {
      slot = detail; mode = m;
      form.querySelector('[data-req=phone]').hidden = mode !== 'phone';
      form.querySelector('[data-req=email]').hidden = mode !== 'visio';
      setStep(slot ? 1 : 0);
    },
  });
  const prof = byId(PROFILES, answers.profile);
  let openedAt = 0;
  root.addEventListener('dg:callback-open', () => { if (!openedAt) { openedAt = Date.now(); mountTurnstile('dgTurnstile').catch(() => {}); } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('dgCbMsg');
    const data = Object.fromEntries(new FormData(form).entries());
    const err = (t) => { msg.textContent = t; msg.className = 's-form-msg err'; };
    if (!slot) return err('Choisissez d\'abord un créneau dans le calendrier.');
    if (!data.name) return err('Indiquez votre nom.');
    if (mode === 'phone' && !data.phone) return err('Indiquez le numéro auquel vous joindre.');
    if (mode === 'visio' && !data.email) return err('Indiquez votre e-mail : le lien de visioconférence vous y sera envoyé.');
    if (!data.consent) return err('Merci de cocher la case d\'accord pour que nous puissions vous recontacter.');
    const btn = document.getElementById('dgCbSubmit'); btn.disabled = true; btn.textContent = 'Envoi…';
    try {
      const res = await fetch(API + '/diagnostic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          ...data, role: prof ? prof.label : '',
          elapsed_ms: openedAt ? Date.now() - openedAt : 0, turnstileToken: getTurnstileToken(),
          slot: slot.human, slot_at: slot.iso, timezone: slot.tz, contact_mode: mode,
          diag: {
            answers: { profile: answers.profile, size: answers.size, domain: answers.domain, situation: answers.situation, tension: answers.tension, deadline: answers.deadline, stakes: answers.stakes, scope: answers.scope },
            text: [answers.sitText, answers.text].filter(Boolean).join('\n'), level: r.level, path: r.path, urgent: r.urgent, title: r.sit.title, summary: r.summary,
          },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const e3 = new Error('HTTP ' + res.status); e3.status = res.status; e3.code = j.error; throw e3;
      }
      setStep(2);
      const how = mode === 'visio' ? 'Visioconférence' : 'Appel téléphonique';
      const links = calendarLinks({ iso: slot.iso, durationMin: slot.durationMin, title: `Pope Online — ${how} avec un conseiller`,
        details: `Rendez-vous demandé avec votre diagnostic flash : ${r.sit.title}.\nUn conseiller vous confirme ce créneau. En cas d'empêchement : 09 70 70 30 55.` });
      form.hidden = true; document.getElementById('dgBooking').hidden = true;
      const done = document.getElementById('dgCbDone');
      done.hidden = false;
      done.innerHTML = `<div class="dg-done-ico" aria-hidden="true"><svg viewBox="0 0 52 52" width="52" height="52"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 27l7 7 15-16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h4>Rendez-vous demandé</h4>
        <p class="dg-done-when"><strong>${esc(slot.dayLabel)} à ${esc(slot.timeLabel)}</strong><br>${esc(how)} · ${slot.durationMin} min · ${esc(slot.tzLabel)}</p>
        <p>${r.urgent ? 'Votre échéance est proche : nous traitons votre demande en priorité.' : 'Un conseiller vous confirme ce créneau par e-mail ou par SMS.'}${mode === 'visio' ? ' Le lien de visioconférence vous sera envoyé par e-mail.' : ''}</p>
        <div class="dg-done-actions"><a class="s-btn s-btn-ghost s-btn-sm" href="${links.icsUrl}" download="rendez-vous-pope-online.ics">Ajouter à mon agenda (.ics)</a>
          <a class="s-btn s-btn-ghost s-btn-sm" href="${links.googleUrl}" target="_blank" rel="noopener">Google Agenda</a></div>`;
      done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e2) {
      resetTurnstile();
      if (e2.status === 429) { err('Trop de demandes depuis cette connexion. Réessayez dans une heure, ou appelez le 09 70 70 30 55.'); return; }
      if (e2.code === 'bot_protection_failed') { err('La vérification anti-robot n\'a pas abouti. Cochez la case de vérification puis réessayez.'); return; }
      if (e2.code === 'invalid_phone') { err('Le numéro de téléphone ne semble pas valide.'); return; }
      msg.innerHTML = 'L\'envoi n\'a pas abouti. Appelez le <a href="tel:+33970703055">09 70 70 30 55</a> ou écrivez à <a href="mailto:contact@pope-online.com">contact@pope-online.com</a>.';
      msg.className = 's-form-msg err';
    } finally { btn.disabled = false; btn.textContent = 'Confirmer mon rendez-vous'; }
  });
}

function render() {
  if (index < 0) return renderIntro();
  if (index >= STEPS.length) return renderResult();
  return renderStep();
}

function next() {
  const st = STEPS[index];
  const ta = document.getElementById('dgText');
  if (st && st.free && ta) answers.text = ta.value.trim().slice(0, 600);
  if (st && st.key === 'situation' && ta) answers.sitText = ta.value.trim().slice(0, 300);
  if (st && st.key === 'situation' && answers.domain === 'autre') answers.situation = 'autre';
  index += 1;
  render();
}

root.addEventListener('click', (e) => {
  const opt = e.target.closest('[data-opt]');
  if (opt) {
    const st = STEPS[index];
    const id = opt.getAttribute('data-opt');
    if (st.multi) {
      const set = new Set(answers.stakes || []);
      set.has(id) ? set.delete(id) : set.add(id);
      answers.stakes = [...set];
      renderStep();
    } else {
      if (st.key === 'domain' && answers.domain !== id) { answers.situation = undefined; answers.sitText = ''; }   // la situation dépend du domaine
      answers[st.key] = id;
      if (st.key === 'situation' && id === 'autre') { renderStep(); return; }   // on attend la description
      opt.classList.add('is-on');
      setTimeout(next, 160);   // passage automatique à la question suivante
    }
    return;
  }
  const act = e.target.closest('[data-act]');
  if (!act) return;
  const a = act.getAttribute('data-act');
  if (a === 'start') { index = 0; render(); }
  else if (a === 'next') next();
  else if (a === 'back') { index = Math.max(-1, index - 1); render(); }
  else if (a === 'restart') { Object.keys(answers).forEach((k) => delete answers[k]); answers.stakes = []; index = 0; render(); }
  else if (a === 'print') window.print();
  else if (a === 'callback') { const f = document.getElementById('dgCallback'); f.hidden = false; root.dispatchEvent(new Event('dg:callback-open')); f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});

render();
