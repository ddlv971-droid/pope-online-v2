# POPE Online V89 — Diagnostic flash

## Origine

Suggestion reçue par message vocal le 13 octobre 2026 : proposer aux personnes qui
arrivent sur la plateforme un outil d'auto-diagnostic, sur le principe d'un arbre de
questions, pour qualifier leur difficulté ou leur besoin avant de nous contacter, et
cibler ensuite l'intervention.

## Ce que fait la V89

1. **Une page publique `diagnostic.html`**, accessible sans compte.
   - Huit questions à choix, une par écran, et un champ libre facultatif : profil,
     taille de la collectivité, domaine, situation précise (39 situations dans
     10 domaines), état de la situation, échéance, enjeux, type de besoin.
   - Résultat immédiat : niveau de vigilance (modérée, élevée, critique), points
     d'attention spécifiques (recours engagé, exposition publique, échéance sous 48 h…),
     ce que l'expert examinera, pièces à rassembler, orientation recommandée
     (Conseil Expert ou accompagnement sur mesure).
   - Trois suites possibles : transmettre à un expert (demande pré-remplie), être
     rappelé avec le diagnostic, imprimer ou enregistrer en PDF.
   - Le calcul se fait dans le navigateur : rien n'est envoyé au serveur sans une
     action explicite de l'élu.

2. **Pré-remplissage de la demande dans l'espace élu** (`dashboard.html`).
   - Le diagnostic est gardé 7 jours dans le navigateur (clé `pope_diag_flash_v1`).
   - À l'ouverture du tableau de bord, connecté directement ou après création de
     compte, la demande est pré-remplie (domaine, titre, contexte, problème,
     objectif, échéance, risques, pièces, type de traitement) et l'élu arrive à
     l'étape 2 avec un message d'explication.
   - Une demande déjà commencée n'est jamais écrasée sans confirmation.
   - L'étape 1 du tableau de bord propose le diagnostic aux élus qui hésitent.

3. **Demandes de rappel enregistrées** (backend).
   - `POST /diagnostic` : coordonnées, accord explicite (case à cocher obligatoire)
     et diagnostic. Enregistrement en base, e-mail à l'équipe (`MAIL_TO`, préfixe
     `[URGENT]` si l'échéance est sous 48 h et la vigilance au moins élevée), accusé
     de réception à l'élu.
   - `GET /admin/diagnostics` et `PATCH /admin/diagnostics/:id` (administrateurs) :
     liste des demandes, triées urgentes d'abord, et suivi du statut
     (`new`, `contacted`, `converted`, `closed`). Pas encore d'écran dédié dans
     `dashboard-admin.html` : les demandes arrivent par e-mail, comme les demandes
     de contact.

4. **Points d'entrée sur le site** : lien sous le bloc principal de l'accueil, encart
   « Nouveau · Diagnostic flash » avant l'exemple de Conseil Expert, lien dans le pied
   de page des pages publiques, entrée dans la recherche du site et dans le plan du
   site.

## Fichiers

| Fichier | Statut |
| --- | --- |
| `frontend/diagnostic.html` | nouveau |
| `frontend/diagnostic.js` | nouveau : moteur et interface |
| `frontend/diagnostic-tree.js` | nouveau : questions, situations, pièces, points examinés |
| `frontend/diagnostic.css` | nouveau |
| `frontend/dashboard.html` | modifié : pré-remplissage, lien étape 1 |
| `frontend/index.html` | modifié : lien et encart |
| `frontend/about.html`, `deontologie.html`, `elus.html`, `pricing.html` | modifiés : lien en pied de page |
| `frontend/site-v88.css` | modifié : styles de l'encart (bloc V89 en fin de fichier) |
| `frontend/public/site-config.js` | version `V89` |
| `frontend/public/site-search.js`, `frontend/public/sitemap.xml` | entrée « Diagnostic flash » |
| `backend/routes/diagnostic.js` | nouveau |
| `backend/db/schema_patch_v93.sql` | nouveau : table `diag_flash_requests` (idempotent) |
| `backend/server.js` | modifié : route, patch V93 rejoué au démarrage, `/health` → `v89-diag` |
| `backend/scripts/db_init.js` | modifié : patch V93 |

Numérotation : la base de données en est déjà au patch V92 (versions V88.x de
l'application) ; le patch du diagnostic flash est donc le V93.

## Déploiement

1. Backend (Render) : déployer. Le patch V93 est appliqué automatiquement
   (`npm start`, et aussi au démarrage de l'API). Aucune nouvelle variable
   d'environnement.
2. Frontend : `npm run build` puis déploiement habituel. Vérifier que `/diagnostic`
   est bien servi (comme `/elus`).
3. Contrôle : `GET /health` doit renvoyer `v89-diag`.

## Faire évoluer l'arbre de questions

Tout le contenu métier est dans `frontend/diagnostic-tree.js` :

- ajouter une situation = une entrée dans `SITUATIONS[domaine]` avec son libellé,
  sa gravité `w` (0 à 2), son titre, les points examinés `q` et les pièces `p` ;
- les règles de vigilance et d'orientation sont dans `computeResult()`
  (`frontend/diagnostic.js`) : score = gravité de la situation + état de la
  situation + échéance + nombre d'enjeux (plafonné à 3) ; critique à partir de 7,
  élevée à partir de 4.

À faire relire par les associés avant mise en ligne : les libellés des situations,
les points examinés et les messages d'alerte (recours, probité, situations
individuelles d'agents).

## Tests réalisés

- Parcours complet dans Chromium (ordinateur et mobile) : questions, retour arrière,
  choix multiples, champ libre, résultat, refus d'envoi sans accord, envoi de la
  demande de rappel (requête vérifiée), pré-remplissage du tableau de bord après
  connexion simulée, effacement du diagnostic une fois utilisé.
- `vite build` : la page est compilée sans charger la feuille de style de
  l'espace connecté.
- Route `/diagnostic` : accord obligatoire, coordonnées obligatoires, pot de miel,
  fonctionnement dégradé sans base ni messagerie, `/admin/diagnostics` refusé sans
  session administrateur.
