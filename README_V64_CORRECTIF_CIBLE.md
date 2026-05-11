# POPE Online V64 — correctif ciblé dashboard

Base : V61 full patch.

Corrections :
- suppression effective du style anti-flash V61 pouvant bloquer les panneaux avec `display:none!important`;
- retour depuis `app.html` / `app-private.html` forcé et stabilisé sur l’étape 2 ;
- aucun nettoyage brutal du stockage lors d’un retour APP ;
- au chargement normal du dashboard, le dernier domaine n’est plus restauré automatiquement ;
- navigation 1 → 2 → 3 → 4 renforcée sans réécrire le backend ;
- hydratation minimale sécurisée de l’étape 3 si les drafts ou le dépôt ne remontent pas ;
- correction du `<script>` imbriqué dans `app.html` et `app-private.html`.

Fichiers principaux ajoutés :
- `frontend/pope-v64-step-state-fix.js`
- `frontend/public/pope-v64-step-state-fix.js`
- `frontend/dist/pope-v64-step-state-fix.js`

La couche V64 est chargée en dernier dans `dashboard.html` et `dashboard-private.html`.
