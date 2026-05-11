# POPE Online V62 — Stabilisation dashboards et APP

## Corrections critiques appliquées

1. **SyntaxError dashboard**
   - Correction de l'attribut inline `onclick="switchTab('besoin')"` inséré dans une chaîne JavaScript.
   - Remplacement par une écriture HTML-safe : `switchTab(&quot;besoin&quot;)`.
   - Correction appliquée à `dashboard.html` et `dashboard-private.html`, source et `dist`.

2. **SyntaxError APP**
   - Suppression d'un `<script>` imbriqué dans un autre `<script>` dans `app.html` et `app-private.html`.
   - Correction appliquée source et `dist`.

3. **Retour APP → dashboard**
   - Suppression des anciens retours automatiques vers `step=3`.
   - Tous les bridges APP forcent désormais le retour vers `?from=app&attach=last&step=2`.
   - Ajout d'un garde V62 contre les anciens timers qui tentaient encore `goStep(3)` après retour depuis APP.

4. **Étape 3 Documents**
   - Conservation du rendu enrichi : draft IA sélectionnable, lien vers dépôt sécurisé, liste des pièces, état visuel.
   - Correction du blocage JS qui empêchait l'étape 3 d'être pleinement exploitable.

5. **Étape 4 Transmission expert**
   - Le bouton Continuer de l'étape 3 peut désormais atteindre l'étape 4.
   - Récapitulatif enrichi : domaine, objet, type, quota, draft sélectionné, pièces déposées, résumé du besoin.

6. **Erreur cgu-*.js**
   - Ajout de gardes `null-safe` sur les pages qui ne contiennent pas `planName`, `planDetails`, `upgradeSection` ou `cancelSection`.
   - Empêche `Cannot set properties of null (setting 'textContent')`.

## Fichiers principaux corrigés

- `frontend/dashboard.html`
- `frontend/dashboard-private.html`
- `frontend/app.html`
- `frontend/app-private.html`
- `frontend/dashboard-v5.js`
- `frontend/dashboard-v61-fix.js`
- `frontend/app-v53-bridge.js`
- `frontend/app-v54.js`
- `frontend/app-v60-bridge.js`
- `frontend/dist/*` équivalents
- `frontend/dist/assets/cgu-*.js`

## Validation statique effectuée

- Vérification syntaxique Node des scripts inline des dashboards et APP : OK.
- Vérification syntaxique Node des principaux scripts JS corrigés : OK.

## Point d'attention déploiement

Si Netlify reconstruit entièrement `dist`, les corrections source sont présentes. Si tu déploies directement `frontend/dist`, les corrections y sont également intégrées.
