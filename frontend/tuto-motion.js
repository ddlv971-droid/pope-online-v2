// POPE Online — motion design du tutoriel : 6 scènes avec avatars, animées en SVG/CSS.
const INK = '#1F2622', GREEN = '#1F4A3D', BLUE = '#0070C0', CYAN = '#00B0F0', LIGHT = '#EDF2EE', AMBER = '#F5A524';

function avatar({ x, y, s = 1, skin, hair, shirt, glasses = false, tie = null, headset = false, flip = false, d = 0 }) {
  return `<g transform="translate(${x},${y}) scale(${flip ? -s : s},${s})"><g class="pm-bob" style="animation-delay:${d}s">
    <path d="M-72 150 Q-72 54 0 54 Q72 54 72 150 Z" fill="${shirt}"/>
    <rect x="-10" y="28" width="20" height="30" rx="6" fill="${skin}"/>
    <path d="M-16 54 L0 78 L16 54 Z" fill="#fff"/>
    ${tie ? `<path d="M-5 62 L5 62 L8 100 L0 108 L-8 100 Z" fill="${tie}"/>` : ''}
    <circle r="36" fill="${skin}"/>
    <path d="M-38 -2 Q-44 -48 0 -46 Q44 -48 38 -2 Q32 -24 0 -26 Q-32 -24 -38 -2Z" fill="${hair}"/>
    <g class="pm-blink"><circle cx="-13" cy="4" r="3.4" fill="${INK}"/><circle cx="13" cy="4" r="3.4" fill="${INK}"/></g>
    ${glasses ? `<g fill="none" stroke="${INK}" stroke-width="2.4"><circle cx="-13" cy="4" r="10"/><circle cx="13" cy="4" r="10"/><path d="M-3 4h6"/></g>` : ''}
    <path d="M-10 19 Q0 28 10 19" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    ${headset ? `<path d="M-38 0 Q-40 -44 0 -44 Q40 -44 38 0" fill="none" stroke="#333" stroke-width="5"/><rect x="-44" y="-6" width="10" height="22" rx="5" fill="#333"/><path d="M-40 14 Q-30 34 -10 30" fill="none" stroke="#333" stroke-width="3"/>` : ''}
  </g></g>`;
}

const ELU = (o = {}) => avatar({ x: 215, y: 250, s: 1.25, skin: '#F2C6A0', hair: '#5A3A22', shirt: GREEN, glasses: false, ...o });
const EXPERT = (o = {}) => avatar({ x: 745, y: 250, s: 1.25, skin: '#C98E64', hair: '#222', shirt: '#14304A', glasses: true, tie: BLUE, ...o });
const CONSEILLER = (o = {}) => avatar({ x: 745, y: 250, s: 1.25, skin: '#8D5A3B', hair: '#1a1a1a', shirt: BLUE, headset: true, ...o });

const desk = (x = 40, w = 360) => `<rect x="${x}" y="372" width="${w}" height="20" rx="8" fill="#B79A74"/><rect x="${x + 24}" y="392" width="12" height="100" fill="#9B805C"/><rect x="${x + w - 36}" y="392" width="12" height="100" fill="#9B805C"/>`;
const laptop = (x = 40) => `<g><rect x="${x + 110}" y="326" width="130" height="46" rx="6" fill="#2B3A35"/><rect x="${x + 96}" y="368" width="158" height="6" rx="3" fill="#44544E"/><circle cx="${x + 175}" cy="349" r="5" fill="#fff" opacity=".85"/></g>`;

const bg = `<rect width="960" height="540" fill="url(#pmWall)"/><rect y="470" width="960" height="70" fill="#D5E1DA"/>
  <circle cx="120" cy="90" r="46" fill="#fff" opacity=".7"/><rect x="560" y="26" width="120" height="70" rx="8" fill="#fff" opacity=".6"/>`;

// Carte « écran » affichée à droite de l'élu
const card = (title, step, body, d = 0.3) => `<g class="pm-a pm-up" style="--d:${d}s">
  <rect x="470" y="70" width="440" height="360" rx="18" fill="#fff" stroke="#C9D8CF" stroke-width="2"/>
  <rect x="470" y="70" width="440" height="46" rx="18" fill="${GREEN}"/><rect x="470" y="98" width="440" height="18" fill="${GREEN}"/>
  <circle cx="494" cy="93" r="5" fill="#fff" opacity=".6"/><circle cx="512" cy="93" r="5" fill="#fff" opacity=".6"/><circle cx="530" cy="93" r="5" fill="#fff" opacity=".6"/>
  <text x="890" y="99" text-anchor="end" font-size="14" font-weight="700" fill="#fff" font-family="Inter,Arial,sans-serif">POPE Online</text>
  <circle cx="504" cy="150" r="15" fill="${BLUE}"/><text x="504" y="156" text-anchor="middle" font-size="16" font-weight="800" fill="#fff" font-family="Inter,Arial,sans-serif">${step}</text>
  <text x="530" y="157" font-size="20" font-weight="800" fill="${INK}" font-family="Inter,Arial,sans-serif">${title}</text>
  ${body}</g>`;

const T = (x, y, t, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 15}" font-weight="${o.w || 600}" fill="${o.fill || INK}" text-anchor="${o.anchor || 'start'}" font-family="Inter,Arial,sans-serif">${t}</text>`;

function pill(x, y, w, label, d, selected = false) {
  const base = `<g class="pm-a pm-pop" style="--d:${d}s"><rect x="${x}" y="${y}" width="${w}" height="40" rx="20" fill="${LIGHT}" stroke="#C9D8CF" stroke-width="1.5"/>${T(x + w / 2, y + 26, label, { anchor: 'middle', size: 14 })}</g>`;
  if (!selected) return base;
  return base + `<g class="pm-a pm-pop" style="--d:3s"><rect x="${x}" y="${y}" width="${w}" height="40" rx="20" fill="${GREEN}"/>${T(x + w / 2, y + 26, '✓ ' + label, { anchor: 'middle', size: 14, fill: '#fff', w: 700 })}</g>`;
}

function field(y, label, w, d) {
  return `${T(504, y, label, { size: 13, fill: '#4B5650', w: 700 })}
    <rect x="504" y="${y + 8}" width="372" height="34" rx="9" fill="#F6F8F5" stroke="#C9D8CF"/>
    <rect class="pm-a pm-grow" style="--d:${d}s" x="514" y="${y + 21}" width="${w}" height="8" rx="4" fill="${BLUE}" opacity=".75"/>`;
}

function file(x, y, ext, color, d) {
  return `<g class="pm-a pm-up" style="--d:${d}s"><rect x="${x}" y="${y}" width="86" height="104" rx="10" fill="#fff" stroke="#C9D8CF" stroke-width="2"/>
    <rect x="${x}" y="${y + 18}" width="86" height="30" fill="${color}"/>${T(x + 43, y + 39, ext, { anchor: 'middle', size: 14, fill: '#fff', w: 800 })}
    <rect x="${x + 12}" y="${y + 62}" width="62" height="6" rx="3" fill="#D9E3DD"/><rect x="${x + 12}" y="${y + 76}" width="46" height="6" rx="3" fill="#D9E3DD"/>
    <circle cx="${x + 74}" cy="${y + 12}" r="11" fill="#22A06B"/><path d="M${x + 68} ${y + 12} l4 4 l7 -8" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

const envelope = (x, y, d) => `<g class="pm-a pm-fly" style="--d:${d}s"><rect x="${x}" y="${y}" width="86" height="58" rx="8" fill="#fff" stroke="${BLUE}" stroke-width="3"/><path d="M${x + 3} ${y + 4} L${x + 43} ${y + 34} L${x + 83} ${y + 4}" fill="none" stroke="${BLUE}" stroke-width="3" stroke-linejoin="round"/></g>`;

const SCENES = [
  {
    title: '1. Choisissez votre domaine',
    text: 'Tout commence par le domaine de votre question : budget, ressources humaines, marchés publics, urbanisme… Votre demande est ensuite confiée à l’expert du bon domaine.',
    svg: () => bg + desk() + ELU() + laptop() +
      card('Choisissez votre domaine', 1,
        pill(504, 190, 168, 'Budget', 0.7) + pill(690, 190, 186, 'Ressources humaines', 1.0, true) +
        pill(504, 246, 168, 'Marchés publics', 1.3) + pill(690, 246, 186, 'Urbanisme', 1.6) +
        pill(504, 302, 168, 'Juridique', 1.9) + pill(690, 302, 186, 'Autre domaine', 2.2) +
        T(504, 392, 'Un expert du domaine vous répond.', { size: 14, fill: '#4B5650', w: 600 }), 0.2) +
      `<g class="pm-a pm-pop" style="--d:.4s"><rect x="150" y="100" width="260" height="62" rx="16" fill="#fff" stroke="#C9D8CF" stroke-width="2"/><path d="M240 162 l16 22 l10 -22z" fill="#fff" stroke="#C9D8CF" stroke-width="2"/><rect x="238" y="156" width="30" height="8" fill="#fff"/>${T(280, 128, 'J’ai une question', { anchor: 'middle', size: 16, w: 800 })}${T(280, 148, 'sur le personnel…', { anchor: 'middle', size: 14, fill: '#4B5650' })}</g>` +
      `<g class="pm-a pm-cursor" style="--d:1.8s"><path d="M728 340 l0 26 l7 -6 l5 12 l6 -3 l-5 -11 l9 0z" fill="${INK}" stroke="#fff" stroke-width="1.5"/></g>`
  },
  {
    title: '2. Qualifiez votre besoin',
    text: 'Décrivez votre situation, ce que vous attendez et votre échéance. Quelques lignes suffisent : plus c’est précis, plus la réponse est utile.',
    svg: () => bg + desk() + ELU({ d: 0.3 }) + laptop() +
      card('Qualifiez votre besoin', 2,
        field(190, 'Contexte', 330, 0.8) + field(252, 'Ce que vous attendez', 270, 1.6) + field(314, 'Échéance', 150, 2.4) +
        `<g class="pm-a pm-pop" style="--d:3.2s"><rect x="704" y="378" width="172" height="40" rx="12" fill="${GREEN}"/>${T(790, 403, 'Continuer →', { anchor: 'middle', size: 14, fill: '#fff', w: 800 })}</g>`, 0.2)
  },
  {
    title: '3. Joignez vos pièces',
    text: 'Ajoutez vos documents (PDF, Word, Excel, PowerPoint, images…) dans le dépôt sécurisé, conservés 48 h. Un premier jet rédigé avec l’outil de rédaction peut aussi être joint, si vous le souhaitez.',
    svg: () => bg + desk() + ELU({ d: 0.6 }) + laptop() +
      card('Joignez vos pièces', 3,
        `<rect x="500" y="180" width="380" height="170" rx="14" fill="#F6F8F5" stroke="#9DB8AA" stroke-width="2" stroke-dasharray="8 6"/>` +
        file(516, 200, 'PDF', '#C0003C', 0.7) + file(612, 200, 'DOC', BLUE, 1.2) + file(708, 200, 'XLS', '#22A06B', 1.7) + file(804, 200, 'JPG', AMBER, 2.2) +
        `<g class="pm-a pm-up" style="--d:2.8s"><rect x="500" y="364" width="380" height="42" rx="12" fill="${LIGHT}"/>${T(520, 390, '🔒 Dépôt sécurisé · supprimé après 48 h', { size: 13.5, fill: GREEN, w: 700 })}</g>`, 0.2)
  },
  {
    title: '4. Votre demande part chez l’expert',
    text: 'Un clic : votre demande, avec ses pièces jointes, arrive à l’équipe POPE Online (contact@pope-online.com) et dans le tableau de bord de l’expert.',
    svg: () => bg + `<rect x="40" y="372" width="880" height="20" rx="8" fill="#B79A74"/>` + ELU({ x: 190, d: 0 }) + EXPERT({ x: 770, d: 0.4 }) +
      `<g class="pm-a pm-pop" style="--d:.3s"><rect x="395" y="150" width="170" height="62" rx="14" fill="#fff" stroke="#C9D8CF" stroke-width="2"/>${T(480, 176, 'Demande + pièces', { anchor: 'middle', size: 14, w: 800 })}${T(480, 196, 'contact@pope-online.com', { anchor: 'middle', size: 12.5, fill: BLUE, w: 700 })}</g>` +
      envelope(290, 270, 0.9) +
      `<g class="pm-a pm-pop" style="--d:3s"><circle cx="770" cy="108" r="36" fill="#fff" stroke="${AMBER}" stroke-width="4"/><path d="M770 84 v26 l16 10" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></g>` +
      `<g class="pm-a pm-up" style="--d:3.3s"><rect x="330" y="420" width="300" height="38" rx="12" fill="${GREEN}"/>${T(480, 445, 'Réponse sous 24 h ouvrées', { anchor: 'middle', size: 14.5, fill: '#fff', w: 800 })}</g>`
  },
  {
    title: '5. Recevez la réponse dans votre espace',
    text: 'L’expert répond sous 24 h ouvrées. Vous êtes prévenu par e-mail et la réponse est disponible dans votre espace, avec l’historique de vos échanges.',
    svg: () => bg + desk() + ELU({ d: 0.2 }) + laptop() +
      card('Réponse de votre expert', 4,
        `<g class="pm-a pm-pop" style="--d:.8s"><rect x="500" y="180" width="170" height="30" rx="15" fill="#DDF3E8"/>${T(585, 201, '✓ Répondu', { anchor: 'middle', size: 14, fill: '#14663f', w: 800 })}</g>` +
        [0, 1, 2, 3, 4].map((i) => `<rect class="pm-a pm-grow" style="--d:${1.2 + i * 0.35}s" x="504" y="${232 + i * 28}" width="${[360, 330, 350, 300, 220][i]}" height="10" rx="5" fill="#C9D8CF"/>`).join('') +
        `<g class="pm-a pm-up" style="--d:3.4s"><rect x="504" y="382" width="372" height="34" rx="10" fill="${LIGHT}"/>${T(522, 404, 'Essai gratuit 15 jours · 2 Conseils Expert offerts', { size: 13, fill: GREEN, w: 700 })}</g>`, 0.2) +
      `<g class="pm-a pm-pop pm-pulse" style="--d:2.4s"><circle cx="882" cy="84" r="22" fill="${AMBER}"/><path d="M882 72 q-10 2 -10 14 v6 h20 v-6 q0 -12 -10 -14z M877 96 q5 6 10 0z" fill="#fff"/></g>`
  },
  {
    title: 'Un besoin plus large ? Le sur mesure',
    text: 'Pour un dossier complexe, un projet à structurer ou un accompagnement suivi : qualifiez votre besoin. Il est envoyé à contact@pope-online.com, avec copie à Pope Consulting, et un conseiller vous rappelle.',
    svg: () => bg + `<rect x="40" y="372" width="880" height="20" rx="8" fill="#B79A74"/>` + ELU({ x: 190 }) + CONSEILLER({ x: 770, d: 0.5 }) +
      `<g class="pm-a pm-pop" style="--d:.4s"><rect x="150" y="76" width="300" height="72" rx="16" fill="#fff" stroke="#C9D8CF" stroke-width="2"/>${T(300, 108, 'Mon projet est plus large…', { anchor: 'middle', size: 16, w: 800 })}${T(300, 130, 'un accompagnement suivi', { anchor: 'middle', size: 14, fill: '#4B5650' })}</g>` +
      `<g class="pm-a pm-up" style="--d:1.4s"><rect x="360" y="190" width="240" height="96" rx="16" fill="${GREEN}"/>${T(480, 226, 'Sur mesure', { anchor: 'middle', size: 18, fill: '#fff', w: 800 })}<rect x="396" y="244" width="168" height="30" rx="15" fill="#fff"/>${T(480, 264, 'Qualifier mon besoin', { anchor: 'middle', size: 13.5, fill: GREEN, w: 800 })}</g>` +
      envelope(330, 300, 2.6) +
      `<g class="pm-a pm-pop" style="--d:4s"><rect x="620" y="76" width="280" height="66" rx="16" fill="#fff" stroke="#C9D8CF" stroke-width="2"/>${T(760, 104, 'Je vous rappelle', { anchor: 'middle', size: 16, w: 800 })}${T(760, 126, 'sous 24 h ouvrées', { anchor: 'middle', size: 14, fill: '#4B5650' })}</g>`
  }
];
const DUR = [6500, 6500, 7000, 7000, 7000, 7500];

export function mountTutoMotion(root) {
  if (!root) return;
  const stage = root.querySelector('.pm-stage');
  const svgHost = stage.querySelector('svg');
  svgHost.innerHTML = `<defs><linearGradient id="pmWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F8F6"/><stop offset="1" stop-color="#DCE8E2"/></linearGradient></defs>` +
    SCENES.map((s, i) => `<g class="pm-sc" id="pmSc${i}">${s.svg()}</g>`).join('');
  const cap = root.querySelector('.pm-cap');
  const bar = root.querySelector('.pm-bar > i');
  const playBtn = root.querySelector('[data-pm=play]');
  const dotsBox = root.querySelector('.pm-dots');
  dotsBox.innerHTML = SCENES.map((s, i) => `<button class="pm-dot" type="button" aria-label="Scène ${i + 1} : ${s.title.replace(/"/g, '')}" data-i="${i}"></button>`).join('');
  const total = DUR.reduce((a, b) => a + b, 0);
  const starts = DUR.map((_, i) => DUR.slice(0, i).reduce((a, b) => a + b, 0));
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = -1, t = 0, playing = false, timer = null;

  function show(i) {
    if (i === cur) return;
    cur = i;
    svgHost.querySelectorAll('.pm-sc').forEach((g, k) => g.classList.toggle('on', k === i));
    dotsBox.querySelectorAll('.pm-dot').forEach((d, k) => d.classList.toggle('on', k === i));
    cap.innerHTML = `<b>${SCENES[i].title}</b><span>${SCENES[i].text}</span>`;
  }
  function seek(ms) {
    t = Math.max(0, Math.min(total - 1, ms));
    let i = starts.findIndex((s, k) => t >= s && t < s + DUR[k]);
    if (i < 0) i = SCENES.length - 1;
    show(i);
    bar.style.width = (t / total * 100).toFixed(2) + '%';
  }
  function tick() {
    t += 100;
    if (t >= total) { t = 0; cur = -1; }
    seek(t);
  }
  function play() { if (playing) return; playing = true; stage.classList.remove('paused'); playBtn.textContent = '❚❚ Pause'; timer = setInterval(tick, 100); }
  function pause() { playing = false; stage.classList.add('paused'); playBtn.textContent = '▶ Lecture'; clearInterval(timer); }
  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  root.querySelector('[data-pm=replay]').addEventListener('click', () => { cur = -1; seek(0); play(); });
  dotsBox.addEventListener('click', (e) => { const b = e.target.closest('.pm-dot'); if (!b) return; const i = +b.dataset.i; cur = -1; seek(starts[i]); });
  seek(0);
  if (reduce) { pause(); return; }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { if (!playing && !root.dataset.userPaused) play(); } else if (playing) pause(); }), { threshold: 0.35 }).observe(stage);
  } else play();
  playBtn.addEventListener('click', () => { root.dataset.userPaused = playing ? '' : '1'; });
}
