/* POPE Online — recherche dans le site (pages publiques), sans dépendance. */
(function () {
  var PAGES = [
    ['Pour qui ?', 'elus.html', 'élus maires adjoints conseillers municipaux collectivités public'],
    ['Qui sommes-nous ?', 'about.html', 'équipe experts Pope Consulting présentation'],
    ['Tarifs', 'pricing.html', 'prix offres abonnement Élu Collectivité Commune essai gratuit pack conseils expert paiement'],
    ['Tester gratuitement', 'signup-public.html', 'essai gratuit inscription créer un compte 15 jours'],
    ['Connexion', 'login.html', 'se connecter compte espace mot de passe'],
    ['Charte de déontologie', 'deontologie.html', 'éthique neutralité confidentialité opposition'],
    ['Tutoriel', 'tutoriel.html', 'vidéo prise en main fonctionnement comment ça marche'],
    ['Résilier mon abonnement', 'resiliation.html', 'résiliation arrêter abonnement'],
    ['Mentions légales', 'legal.html', 'éditeur hébergeur société'],
    ['CGU', 'cgu.html', 'conditions générales d’utilisation'],
    ['CGV', 'cgv.html', 'conditions générales de vente'],
    ['Confidentialité', 'privacy.html', 'données personnelles RGPD cookies vie privée'],
    ['Être rappelé', '#contact', 'contact rappel téléphone conseiller écrire devis', true]
  ];
  var norm = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var back, input, list, last;
  function build() {
    back = document.createElement('div'); back.className = 's-search-back'; back.setAttribute('aria-hidden', 'true');
    back.innerHTML = '<div class="s-search" role="dialog" aria-modal="true" aria-label="Rechercher dans le site"><input type="search" placeholder="Rechercher : tarifs, tutoriel, contact…" aria-label="Rechercher"/><ul></ul></div>';
    document.body.appendChild(back);
    input = back.querySelector('input'); list = back.querySelector('ul');
    input.addEventListener('input', render);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && back.classList.contains('open')) close(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var a = list.querySelector('a,button'); if (a) a.click(); } });
    list.addEventListener('click', function (e) { if (e.target.closest('[data-contact]')) close(); });
  }
  function render() {
    var q = norm(input.value).split(/\s+/).filter(Boolean);
    var hits = PAGES.filter(function (p) { var h = norm(p[0] + ' ' + p[2]); return q.every(function (w) { return h.indexOf(w) > -1; }); });
    list.innerHTML = hits.length ? hits.map(function (p) {
      var tag = p[3] ? 'a href="#contact" data-contact="rappel"' : 'a href="' + p[1] + '"';
      return '<li><' + tag + '>' + p[0] + '<small>' + p[2].split(' ').slice(0, 5).join(' · ') + '</small></a></li>';
    }).join('') : '<li class="s-search-empty">Aucun résultat. Essayez « tarifs » ou « contact ».</li>';
  }
  function open() { if (!back) build(); last = document.activeElement; back.classList.add('open'); back.setAttribute('aria-hidden', 'false'); input.value = ''; render(); setTimeout(function () { input.focus(); }, 30); }
  function close() { back.classList.remove('open'); back.setAttribute('aria-hidden', 'true'); if (last && last.focus) last.focus(); }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-search]')) { e.preventDefault(); open(); } });
})();
