# POPE Online — V61+ stabilisation corrective et UX

Base traitée : archive V60 fournie (`v60 es.zip`).

## Périmètre respecté

- Backend conservé sans modification fonctionnelle.
- Pages de référence conservées : `dashboard.html`, `dashboard-private.html`, `app.html`, `app-private.html`.
- Anciennes variantes `dashboard2`, `dashboard-private2`, `app2`, `app-private2`, `vault2`, `pope2.js/css` renommées en `.deprecated` pour éviter tout usage accidentel.
- Pas de refonte d’architecture : corrections ciblées sur le front, les scripts de dashboard et le wording.

## Corrections principales

### Dashboards public / privé

- Retour depuis `app.html` et `app-private.html` stabilisé vers `step=2` uniquement.
- Neutralisation du vieux bridge V60 qui forçait `step=3`.
- Au chargement initial, le dashboard revient à l’étape 1, sauf paramètre URL explicite (`from=app`, `step=3` depuis dépôt, etc.).
- `goStep`, `selectDomain`, `saveDashboardState`, `restoreDashboardState` repatchés en dernier par `dashboard-v61-fix.js`.
- Étape 3 restaurée : sélection des drafts, dépôt sécurisé, liste de pièces, lien de gestion.
- Étape 4 restaurée : récapitulatif, draft IA joint, pièces déposées, résumé du besoin.
- Persistance renforcée entre `localStorage` et `sessionStorage`.

### Bandeau utilisateur

- Le prénom n’est plus déduit de l’email.
- Priorité aux champs : `first_name`, `firstname`, `given_name`, `prenom`, `full_name`, `name`.
- Affichage propre : premier mot uniquement, majuscule initiale.
- Mapping élargi des quotas experts : `expert_left`, `expert_remaining`, `expert_requests_left`, `consultations_left`.

### Offres tarifaires

- Free : **2 conseils experts offerts** en gras et en première position.
- Starter : 89 € HT / mois, 908 € HT / an.
- Pro : 149 € HT / mois, 1520 € HT / an.
- Pro : 12 conseils experts / mois.
- Conseils experts replacés avant l’outil IA dans les listes d’offres.

### UX / wording public et privé

- Recentrage vers l’expertise humaine.
- Espace public : remplacement de “Clausier officiel” par un cas d’usage métier crédible : préparation de dossier marché public.
- Section public “Pourquoi POPE Online ?” : grille 3 colonnes homogène en desktop.
- Section public “Profils utilisateurs” : grille 4 colonnes homogène en desktop.
- “30 cas...” remplacé par “+30 cas d’usage”.
- “12 domaines d’expertise” remplacé par “+12 domaines d’expertise” lorsque présent.

## Point de build

Le build local n’a pas pu être exécuté dans l’environnement de travail car la dépendance optionnelle native Rollup `@rollup/rollup-linux-x64-gnu` est absente du `node_modules` fourni. C’est le bug npm/rollup classique des optional dependencies.

Sur Netlify ou en local propre, lancer :

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

Les fichiers sources corrigés ont aussi été copiés dans `frontend/dist` pour sécuriser l’archive fournie.
