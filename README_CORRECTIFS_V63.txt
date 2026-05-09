POPE Online V63 — correctif critique dashboards

Cause identifiée dans V62 :
- Les dashboards contenaient encore des onclick inline appelant goStep() et selectDomain().
- Un script inline contenait aussi une erreur de syntaxe liée à la chaîne "l'onglet Mon Besoin" et à onclick="switchTab('besoin')" dans une chaîne JavaScript.
- Résultat : les fonctions globales n'étaient pas disponibles de manière fiable au moment des clics, d'où les erreurs :
  Uncaught ReferenceError: selectDomain is not defined
  Uncaught ReferenceError: goStep is not defined

Corrections V63 :
- Suppression des onclick inline critiques dans dashboard.html et dashboard-private.html.
- Remplacement par attributs data-v63-* et addEventListener dans dashboard-v63.js.
- Ajout d'un moteur dashboard-v63.js non-module, chargé explicitement en fin de page.
- Exposition de compatibilité window.goStep, window.selectDomain, window.switchTab, window.v58Toggle.
- Correction de l'erreur de syntaxe JavaScript dans les scripts inline existants.
- Maintien du bandeau dynamique qui fonctionnait déjà en V62.
- Conservation de la persistance localStorage/sessionStorage du parcours.

Tests statiques effectués :
- node --check dashboard-v63.js : OK
- vérification syntaxe scripts inline dashboard.html : OK
- vérification syntaxe scripts inline dashboard-private.html : OK
- aucun onclick="goStep(...)" ni onclick="selectDomain(this)" restant dans les deux dashboards.

Aucun patch SQL nécessaire.
