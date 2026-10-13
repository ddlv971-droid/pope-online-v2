// ============================================================================
// POPE Online V89 — Diagnostic flash (moteur et interface)
// L'élu répond à 8 questions courtes, en 2 minutes. Le diagnostic est calculé
// dans le navigateur : rien n'est envoyé tant que l'élu ne le demande pas
// (transmission à un expert, ou demande de rappel).
// ============================================================================
import { PROFILES, SIZES, DOMAINS, SITUATIONS, TENSION, DEADLINES, STAKES, SCOPES } from './diagnostic-tree.js';

const API = ((import.meta.env && import.meta.env.VITE_API_URL) || 'https://pope-online-v2.onrender.com').trim().replace(/\/$/, '');
export const DIAG_KEY = 'pope_diag_flash_v1';   // lu par dashboard.html pour pré-remplir la demande

const byId = (list, id) => list.find((x) => x.id === id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ─── Les questions, dans l'ordre ───────────────────────────────────────────
const STEPS = [
  { key: 'profile', title: 'Vous êtes…', options: () => PROFILES },
  { key: 'size', title: 'Votre collectivité compte…', options: () => SIZES },
  { key: 'domain', title: 'Votre sujet concerne…', options: () => DOMAINS },
  { key: 'situation', title: 'Plus précisément, votre situation est…', options: (a) => SITUATIONS[a.domain] || SITUATIONS.autre },
  { key: 'tension', title: 'La situation a-t-elle déjà dégénéré ?', options: () => TENSION },
  { key: 'deadline', title: 'Quand devez-vous décider ou agir ?', options: () => DEADLINES },
  { key: 'stakes', title: 'Quels enjeux sont en cause ?', hint: 'Plusieurs réponses possibles.', multi: true, options: () => STAKES },
  { key: 'scope', title: 'Ce dont vous avez besoin, c\'est plutôt…', options: () => SCOPES },
  { key: 'text', title: 'En quelques mots, que se passe-t-il ?', hint: 'Facultatif. Ces lignes pré-rempliront votre demande ; n\'indiquez pas de nom de personne.', free: true },
];

// ─── Lecture des réponses : vigilance, orientation, points d'attention ─────
export function computeResult(a) {
  const dom = byId(DOMAINS, a.domain) || DOMAINS[DOMAINS.length - 1];
  const sit = byId(SITUATIONS[a.domain] || SITUATIONS.autre, a.situation) || SITUATIONS.autre[0];
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
  if (dl.id === '48h') alerts.push('L\'échéance est très proche : indiquez-la dans votre demande. Si la décision doit être prise avant la réponse de l\'expert, appelez un conseiller.');
  if (a.domain === 'rh' && (sit.id === 'disc' || sit.id === 'harc')) alerts.push('Sur une situation individuelle d\'agent, conservez une trace écrite de chaque étape et ne prenez aucune mesure avant d\'avoir vérifié la procédure.');
  if (a.domain === 'jur' && sit.id === 'probite') alerts.push('En cas de doute sur un intérêt personnel, l\'élu concerné ne doit ni participer à la préparation de la décision ni prendre part au vote.');

  const profile = byId(PROFILES, a.profile);
  const size = byId(SIZES, a.size);
  const pieces = [...sit.p, 'Toute décision ou tout courrier déjà échangé sur le sujet'];
  const summary = `Vigilance ${levelLabel.toLowerCase()} · échéance : ${dl.label.toLowerCase()} · orientation : ${complex ? 'accompagnement sur mesure' : 'Conseil Expert'}.`;

  // Pré-remplissage de la demande dans l'espace élu (étape 2 du tableau de bord)
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

function isLoggedIn() {
  try { return localStorage.getItem('pope_session_active') === '1' || !!localStorage.getItem('pope_session_token') || !!sessionStorage.getItem('pope_session_token'); }
  catch (e) { return false; }
}

function progress() {
  const pct = Math.round((Math.max(index, 0) / STEPS.length) * 100);
  return `<div class="dg-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${STEPS.length}" aria-valuenow="${index + 1}" aria-label="Question ${index + 1} sur ${STEPS.length}"><i style="width:${pct}%"></i></div>
    <p class="dg-count">Question ${index + 1} sur ${STEPS.length}</p>`;
}

function renderIntro() {
  root.innerHTML = `
    <div class="dg-card dg-intro">
      <p class="s-kicker">Diagnostic flash · 2 minutes</p>
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
  let body;
  if (st.free) {
    body = `<label class="dg-free"><span class="s-sr">${esc(st.title)}</span>
      <textarea id="dgText" rows="5" maxlength="600" placeholder="Ex. : le conseil se réunit jeudi ; nous devons voter une modification des tarifs et l'opposition conteste la procédure.">${esc(answers.text || '')}</textarea></label>`;
  } else {
    const opts = st.options(answers);
    body = `<div class="dg-options${opts.length > 6 ? ' dg-options-2' : ''}" role="${st.multi ? 'group' : 'radiogroup'}" aria-label="${esc(st.title)}">` +
      opts.map((o) => {
        const sel = st.multi ? (answers.stakes || []).includes(o.id) : answers[st.key] === o.id;
        return `<button type="button" class="dg-opt${sel ? ' is-on' : ''}" ${st.multi ? `aria-pressed="${sel}"` : `role="radio" aria-checked="${sel}"`} data-opt="${esc(o.id)}">
          <span class="dg-opt-mark" aria-hidden="true"></span><span>${esc(o.label)}</span></button>`;
      }).join('') + '</div>';
  }
  const canNext = st.free || st.multi || answers[st.key];
  root.innerHTML = `
    <div class="dg-card">
      ${progress()}
      <h2 class="dg-q" id="dgQ" tabindex="-1">${esc(st.title)}</h2>
      ${st.hint ? `<p class="dg-hint">${esc(st.hint)}</p>` : ''}
      ${body}
      <div class="dg-nav">
        <button type="button" class="s-btn s-btn-ghost s-btn-sm" data-act="back">← Retour</button>
        ${st.multi || st.free ? `<button type="button" class="s-btn s-btn-primary s-btn-sm" data-act="next">${index === STEPS.length - 1 ? 'Voir mon diagnostic' : (st.multi && !(answers.stakes || []).length ? 'Passer' : 'Continuer')} →</button>`
          : `<button type="button" class="s-btn s-btn-primary s-btn-sm" data-act="next" ${canNext ? '' : 'disabled'}>Continuer →</button>`}
      </div>
    </div>`;
  const q = document.getElementById('dgQ'); if (q) q.focus({ preventScroll: true });
}

function renderResult() {
  const r = computeResult(answers);
  try { localStorage.setItem(DIAG_KEY, JSON.stringify({ v: 1, at: Date.now(), domain: r.dom.domain, domainIcon: '🎯', need: r.need, level: r.level })); } catch (e) {}
  const logged = isLoggedIn();
  const sendHref = logged ? 'dashboard.html?diag=1' : 'signup-public.html?from=diag';
  const pathCard = r.path === 'surmesure'
    ? `<h3>Accompagnement sur mesure</h3><p>Votre situation dépasse une question ponctuelle : plusieurs enjeux, une durée ou une organisation à revoir. Nous vous proposons un échange avec un conseiller pour cadrer un accompagnement, par exemple un diagnostic approfondi suivi d'un plan d'action. Vous pouvez aussi poser dès maintenant votre question la plus urgente à un expert.</p>`
    : `<h3>Conseil Expert</h3><p>Votre besoin se prête à un Conseil Expert : un expert du domaine étudie votre dossier et vous répond par écrit sous ${esc((window.POPE_SITE && window.POPE_SITE.responseDelay) || '24 h')} ouvrées, avec une réponse utilisable en séance.</p>`;
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
          <a class="s-btn s-btn-primary" href="${sendHref}">${logged ? 'Transmettre à un expert' : 'Créer mon compte et transmettre'} →</a>
          <button class="s-btn s-btn-ghost" type="button" data-act="callback">${r.urgent || r.path === 'surmesure' ? 'Être rappelé rapidement' : 'Être rappelé par un conseiller'}</button>
        </div>
        <p class="dg-path-note">${logged ? 'Votre demande sera pré-remplie avec ce diagnostic : il vous restera à la relire et à joindre vos pièces.' : 'Essai gratuit 15 jours, 2 Conseils Expert offerts, sans carte bancaire. Votre demande sera pré-remplie avec ce diagnostic.'}</p>
      </div>

      <form class="s-form dg-callback" id="dgCallback" hidden novalidate>
        <h3 class="s-field-full">Être rappelé avec ce diagnostic</h3>
        <label class="s-field">Nom et prénom<input name="name" autocomplete="name" required/></label>
        <label class="s-field">Collectivité<input name="organization" placeholder="Commune de…"/></label>
        <label class="s-field">E-mail<input name="email" type="email" autocomplete="email"/></label>
        <label class="s-field">Téléphone<input name="phone" type="tel" autocomplete="tel"/></label>
        <label class="s-field s-field-full">Créneau souhaité<input name="slot" placeholder="Ex. demain matin, heure de Mayotte"/></label>
        <label class="s-field-full dg-consent"><input type="checkbox" name="consent" value="1"/> J'accepte que ce diagnostic et mes coordonnées soient transmis à l'équipe Pope Online pour être recontacté. <a href="privacy.html">Confidentialité</a></label>
        <input name="website" tabindex="-1" autocomplete="off" class="s-hp" aria-hidden="true"/>
        <p class="s-form-msg" id="dgCbMsg" role="status"></p>
        <div class="s-field-full s-form-actions"><button class="s-btn s-btn-primary" type="submit" id="dgCbSubmit">Envoyer ma demande de rappel</button></div>
      </form>

      <div class="dg-foot">
        <button type="button" class="dg-link" data-act="print">Imprimer ou enregistrer en PDF</button>
        <button type="button" class="dg-link" data-act="restart">Refaire le diagnostic</button>
      </div>
      <p class="dg-disclaimer">Ce diagnostic est une première orientation, établie à partir de vos seules réponses. Il ne remplace pas l'analyse d'un expert sur pièces.</p>
    </div>`;
  const h = root.querySelector('.dg-res-title'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const form = document.getElementById('dgCallback');
  const prof = byId(PROFILES, answers.profile);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('dgCbMsg');
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name || (!data.email && !data.phone)) { msg.textContent = 'Indiquez votre nom et un moyen de vous joindre (e-mail ou téléphone).'; msg.className = 's-form-msg err'; return; }
    if (!data.consent) { msg.textContent = 'Merci de cocher la case d\'accord pour que nous puissions vous recontacter.'; msg.className = 's-form-msg err'; return; }
    const btn = document.getElementById('dgCbSubmit'); btn.disabled = true; btn.textContent = 'Envoi…';
    try {
      const res = await fetch(API + '/diagnostic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          ...data, role: prof ? prof.label : '',
          diag: {
            answers: { profile: answers.profile, size: answers.size, domain: answers.domain, situation: answers.situation, tension: answers.tension, deadline: answers.deadline, stakes: answers.stakes, scope: answers.scope },
            text: answers.text || '', level: r.level, path: r.path, urgent: r.urgent, title: r.sit.title, summary: r.summary,
          },
        }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      form.reset();
      msg.textContent = r.urgent ? 'Merci, votre demande est partie en priorité. Un conseiller vous rappelle au plus vite.' : 'Merci, votre demande est bien partie. Un conseiller vous rappelle sous un jour ouvré.';
      msg.className = 's-form-msg ok';
    } catch (err) {
      msg.innerHTML = 'L\'envoi n\'a pas abouti. Appelez le <a href="tel:+33970703055">09 70 70 30 55</a> ou écrivez à <a href="mailto:contact@pope-online.com">contact@pope-online.com</a>.';
      msg.className = 's-form-msg err';
    } finally { btn.disabled = false; btn.textContent = 'Envoyer ma demande de rappel'; }
  });
}

function render() {
  if (index < 0) return renderIntro();
  if (index >= STEPS.length) return renderResult();
  return renderStep();
}

function next() {
  const st = STEPS[index];
  if (st && st.free) answers.text = (document.getElementById('dgText') || {}).value?.trim().slice(0, 600) || '';
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
      if (st.key === 'domain' && answers.domain !== id) answers.situation = undefined;   // la situation dépend du domaine
      answers[st.key] = id;
      setTimeout(next, 160);   // passage automatique à la question suivante
      opt.classList.add('is-on');
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
  else if (a === 'callback') { const f = document.getElementById('dgCallback'); f.hidden = false; f.querySelector('[name=name]').focus(); f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});

render();
