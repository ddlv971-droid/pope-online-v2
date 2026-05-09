# POPE Online — V61 Corrections ciblées

## Correctifs appliqués

1. **Scripts réellement chargés**
   - `dashboard.html` et `dashboard-private.html` ne chargent plus `./dashboard-v60.js`.
   - Ils chargent désormais :
     - `./pope-state-v61.js`
     - `./dashboard-v61.js`
   - `app.html` et `app-private.html` ne chargent plus `./app-v60-bridge.js`.
   - Ils chargent désormais :
     - `./pope-state-v61.js`
     - `./app-v61.js`

2. **Retour depuis l’outil IA stabilisé**
   - Le retour depuis `app.html` ou `app-private.html` pointe toujours vers :
     - `dashboard.html?from=app&step=2`
     - `dashboard-private.html?from=app&step=2`
   - Même si un draft IA est généré, aucune redirection automatique vers l’étape 3 n’est déclenchée.

3. **Persistance Dashboard ↔ APP**
   - Ajout du gestionnaire `pope-state-v61.js`.
   - Conservation du domaine, des champs de besoin, du draft sélectionné et des documents récupérés.

4. **Étape 3 restaurée**
   - Rechargement des drafts IA depuis les clés V61 et legacy.
   - Affichage d’une liste de drafts sélectionnables.
   - Affichage de cartes de drafts.
   - Récupération du dépôt sécurisé via `/vault/list`.

5. **Étape 4 restaurée**
   - Récapitulatif enrichi avec :
     - domaine ;
     - objet ;
     - type de traitement ;
     - quota ;
     - draft IA sélectionné ;
     - nombre de pièces du dépôt sécurisé ;
     - contexte conservé.

6. **Bandeau utilisateur hydraté**
   - Lecture cache localStorage.
   - Requête `/auth/me` si token disponible.
   - Remplissage de `dashWelcome`, `planN`, `expertLeftN`.

## Remarque build
Le build local n’a pas pu être exécuté dans l’environnement de génération car la dépendance optionnelle native Rollup Linux manquait dans le `node_modules` extrait du ZIP. Le code source a été corrigé, contrôlé syntaxiquement avec `node --check`, et les fichiers essentiels ont aussi été recopiés dans `frontend/dist` pour éviter une livraison avec un ancien dist.

Pour un build propre sur votre machine ou Netlify :

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

