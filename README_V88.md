# POPE Online V88 — Repositionnement élus

Base : sauvegarde V87 du 03/10/2026. Référence : *Cahier des modifications du site (repositionnement élus)*.

Décisions des associés intégrées : délai de réponse **24 h**, abonnement **payé par l'élu**, offres **Starter et Pro supprimées**, **remise annuelle 15 %**, mention « 5 à 10× moins cher » **retirée**, identité visuelle **sans bleu**, plus humaine, sans photos de banque d'images et avec l'IA en retrait.

---

## 1. Déploiement en staging

À la racine du dépôt (là où se trouvent `frontend/` et `backend/`) :

```bash
git checkout <votre-branche-de-staging>        # celle publiée par Netlify (branch-deploy) et Render staging
git pull
# décompresser l'archive POPE_Online_V88_fichiers.zip à la racine du dépôt (écraser les fichiers existants)
git add -A
git commit -m "V88 — repositionnement élus : vitrine, offres Élu/Collectivité, sécurité Stripe, quotas, thème"
git push origin <votre-branche-de-staging>
```

Alternative sans archive : `git apply --index V88.patch` puis commit et push.

Au démarrage, l'API exécute `scripts/db_init.js`, qui applique automatiquement `schema_patch_v89.sql`. Ce patch peut être rejoué sans risque (vérifié deux fois de suite sur PostgreSQL).

### Variables d'environnement (Render, staging puis prod)

| Variable | Valeur | Rôle |
|---|---|---|
| `PRIVATE_SPACE_ENABLED` | `false` (valeur par défaut si absente) | Espace entreprises en veille : les nouvelles inscriptions « private » sont refusées. |
| `STRIPE_WEBHOOK_SECRET` | secret `whsec_…` de l'endpoint staging | Obligatoire en production. En staging, sans secret, la signature n'est pas vérifiée : à renseigner pour tester en conditions réelles. |
| `MAIL_TO` | `contact@pope-online.com` | Destinataire des demandes d'experts. La valeur par défaut est désormais unifiée. |

Côté site, l'équivalent de l'interrupteur se trouve dans `frontend/public/site-config.js` (`privateSpaceEnabled`).

### Stripe : liens de paiement à créer (mode test, puis live)

| Clé dans `site-config.js` | Produit | Prix HT | Type | Métadonnée `plan_code` |
|---|---|---|---|---|
| `elu_m` | Offre Élu | 49 € | abonnement mensuel | `ELU_M` |
| `elu_a` | Offre Élu (annuel) | 499,80 € | abonnement annuel | `ELU_A` |
| `collectivite_m` | Offre Collectivité | 499 € | abonnement mensuel | `COLLECTIVITE_M` |
| `collectivite_a` | Offre Collectivité (annuel) | 5 089,80 € | abonnement annuel | `COLLECTIVITE_A` |
| `credit` | Conseil Expert à l'unité | 25 € | paiement unique | `CREDIT` (lien existant conservé) |

1. Créez chaque lien dans Stripe et ajoutez la métadonnée `plan_code` au lien ou au prix.
2. Copiez les URL dans `frontend/public/site-config.js`, rubriques `stripe.test` et `stripe.live`.
3. Tant qu'un lien est vide, le bouton propose un contact par e-mail. L'offre Collectivité propose aussi un devis.

La page Tarifs ajoute automatiquement deux paramètres à chaque lien :
- `client_reference_id=<offre>--<identifiant du compte>` : l'abonnement est rattaché au bon compte, même si l'élu paie avec une autre adresse ;
- `prefilled_email`.

Pour souscrire, il faut être connecté. Sinon, la page propose de se connecter ou de créer un compte.

Événements à activer sur l'endpoint webhook (`/billing/webhook`) :
- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.deleted`

---

## 2. Ce qui change

### Corrections de fond (présentes en V87, en production)

| # | Problème V87 | Correction V88 |
|---|---|---|
| 1 | Webhook Stripe accepté **sans signature** : activation d'un abonnement possible sans paiement. | Signature obligatoire dès qu'un secret est configuré, horodatage contrôlé (5 min), comparaison sûre. Un événement en échec est libéré pour que Stripe le renvoie. |
| 2 | Essai gratuit : `tickets_expert = 9999`, donc **Conseils Expert illimités** au lieu de 2. Idem pour les comptes réinscrits sans essai. | Essai limité à 2 Conseils Expert. `tickets_expert` ne désigne plus que les **crédits achetés à l'unité**. |
| 3 | Abonnés payants **bloqués dès le 2ᵉ mois** : les crédits n'étaient pas rechargés au renouvellement. | Contrôle unique : quota mensuel de l'offre, puis crédits à l'unité. |
| 4 | Achat d'un Conseil Expert à 25 € = **activation d'un abonnement Starter**. | Le paiement unique ajoute un crédit. |
| 5 | Plan déduit du montant avec des seuils mal ordonnés (un Pro à 149 € enregistré comme Starter). | Offre lue dans la référence transmise par la page Tarifs, puis la métadonnée, puis le montant exact. |
| 6 | Quota des offres annuelles remis à zéro une fois par an. | Tâche de remise à zéro mensuelle (offres annuelles). |
| 7 | `/expert/request` accessible sans connexion, donc sans quota. | Connexion obligatoire. |
| 8 | `www.pope-online.com` considéré comme staging (liens Stripe de test affichés). | Détection prod/staging corrigée (`site-config.js`). |
| 9 | `app.html` et `app-private.html` contenaient **deux copies du document**, et un script cassé : bannière de quota inopérante, identifiants HTML en double. | Fichiers réparés : une seule copie, version la plus récente du script. |
| 10 | `login.html` : balise `<script>` orpheline, le script anti-préremplissage V87 ne s'exécutait pas. | Corrigé. |
| 11 | `vite.config.js` pouvait échouer aléatoirement sur un fichier temporaire. | Filtre sur l'extension avant `statSync`. |
| 12 | Lien du mail « réponse d'expert » codé en dur sur la prod (depuis le staging aussi). | URL du site résolue selon l'environnement. |

### Offres

| Offre | Prix HT | Contenu |
|---|---|---|
| Découverte | 0 €, 15 jours | 2 Conseils Expert |
| Élu | 49 €/mois ou 499,80 €/an | 10 Conseils Expert par mois |
| Collectivité | 499 €/mois ou 5 089,80 €/an | Conseils Expert illimités |
| Crédit à l'unité | 25 € | 1 Conseil Expert |

- Catalogue unique côté API : `backend/services/plans.js`.
- Starter, Pro et Premium ne sont plus proposés. Ils restent reconnus pour d'éventuels abonnés historiques, et dans le menu admin avec la mention « historique ».
- Le tableau de bord, le profil et l'outil de rédaction reconnaissent Élu et Collectivité comme offres payantes. Les messages de quota renvoient vers ces offres.
- L'admin propose les offres Élu et Collectivité. Le bouton « offre standard » passe le compte en offre Élu.

### Espace entreprises (privé) en veille, rien n'est supprimé

- Les pages, le code, le prompt IA dédié et les comptes existants sont conservés.
- Le privé est retiré du menu, des pieds de page et du sitemap. Ses pages passent en `noindex` (balise et en-tête HTTP) et `robots.txt` les exclut.
- Inscription privée : l'API répond `private_space_disabled` et la page affiche un message à la place du formulaire.
- Pour réactiver : `PRIVATE_SPACE_ENABLED=true` (API) et `privateSpaceEnabled: true` (`site-config.js`).

### Site vitrine (textes du cahier, délai porté à 24 h)

- **Accueil** réécrit (`index.html`) : le bloc « Deux univers » est supprimé. L'élément central est un échange question d'élu / réponse d'expert, présenté comme une illustration.
- **Page « Pour les élus »** (`elus.html`) : profils, exemples de questions, parcours, « Pourquoi POPE Online ». Redirection 301 depuis `/public` et `/public.html`.
- **Tarifs** (`pricing.html`) : trois offres, bascule mensuel/annuel (−15 %), Conseil à l'unité, FAQ du cahier (« c'est l'élu qui paie »).
- **« Qui sommes-nous »** (`about.html`) réécrite pour les élus.
- **Menu** : Pour les élus · Exemples de questions · Tarifs · Qui sommes-nous · Contact · Connexion · *Tester gratuitement*.
- **Balises** `title` et `meta description` reprises du cahier. Sitemap mis à jour.
- **Inscription** (`signup-public.html`) : textes élus, champs **Fonction** et **Taille de la commune** (enregistrés en base). `signup.html` redirige vers cette page en conservant `?ref=`.

### Identité visuelle

- **Palette** :

  | Rôle | Couleur |
  |---|---|
  | Principale (sapin) | `#1F4A3D` |
  | Sapin profond | `#163629` |
  | Fond | `#F6F7F4` |
  | Teinte claire (lichen) | `#DDE6DF` |
  | Accent ocre, parcimonieux | `#A8741F` |
  | Texte (encre) | `#1F2622` |

  Environ 1 800 occurrences de bleu converties dans 100 fichiers.
- **Typographies auto-hébergées** (licence OFL, aucun appel à Google) : Source Serif 4 pour les titres, Public Sans pour le texte.
- **Logo** : l'arbre « circuit électronique » est remplacé par un arbre sobre, sur les mêmes noms et dimensions de fichiers. Il existe une version claire pour les panneaux sombres. C'est une **proposition** à soumettre à votre graphiste.
- **Photos** : la mosaïque (casque, soudeur, flèche), l'image d'ambiance et le filigrane flottant sont retirés ou remplacés par des aplats.
- **Thème commun** : `frontend/public/theme-v88.css`, chargé en dernier sur les 42 pages de l'application.

### IA en retrait, humain en premier

- « Draft IA » et « génération IA » deviennent « premier jet » et « outil de rédaction ». « Relecture » devient « Conseil Expert ».
- Le prompt de l'outil de rédaction est recentré sur l'élu : langage simple, points de vigilance, renvoi vers un Conseil Expert. Il se termine par une mention « premier jet à faire relire par un expert ».
- Les domaines du tableau de bord sont réordonnés (RH, Finances, Marchés publics, Droit public, Médiation, Communication de crise), les autres passent sous « Et aussi ».

### E-mails

Fin d'essai (API et script cron), activation, crédit ajouté, renouvellement, résiliation et réponse d'expert sont réécrits. Ils ne mentionnent plus d'espace, ni Starter/Pro, ni « relecture ».

### Base de données (`schema_patch_v89.sql`)

- `users.user_function` et `users.commune_size`.
- `wallets.quota_period_start`.
- Table `app_migrations`.
- Normalisation des crédits, exécutée **une seule fois** : `tickets_expert` est remis à 0, car en V87 il valait 9999 ou reproduisait le quota.

---

## 3. Recette staging (cahier + contrôles techniques)

- [ ] Plus aucune mention « Espace privé », « artisans », « TPE », « URSSAF » dans le menu, l'accueil et le pied de page.
- [ ] Le prix de 49 € est identique sur l'accueil, la page élus et la page Tarifs ; le délai de 24 h aussi.
- [ ] « Conseil Expert » est accordé au masculin partout.
- [ ] Les liens d'inscription mènent tous au parcours élu (`signup-public.html`).
- [ ] `/public` et `/public.html` redirigent (301) vers `/elus`.
- [ ] L'affichage est correct sur téléphone.
- [ ] Inscription → validation de l'e-mail → 2 Conseils Expert disponibles ; le 3ᵉ est refusé avec un message clair.
- [ ] Inscription « private » refusée (API 403 et message sur la page).
- [ ] Paiement test Élu mensuel : offre active, 10 Conseils Expert, e-mail reçu.
- [ ] Paiement test Conseil à l'unité : +1 crédit, l'offre reste inchangée.
- [ ] Appel du webhook sans signature : réponse 400.
- [ ] Résiliation test : compte consultable, nouveaux Conseils Expert refusés (« subscription_required »).
- [ ] Les comptes privés existants se connectent toujours et accèdent à leur tableau de bord.

---

## 4. Points à confirmer ou à traiter ensuite

1. **Délai de 24 h** : ouvré ou calendaire ? Il est affiché « sous 24 h » partout. À préciser dans les CGV.
2. **Conseil Expert à l'unité (25 €)** : conservé pour les abonnés Élu. À confirmer.
3. **CGU / CGV / confidentialité** : elles décrivent encore les deux espaces. Une relecture juridique est nécessaire (non modifiées).
4. **Mise en avant Antilles-Guyane** sur « Qui sommes-nous » : non intégrée, en attente de votre validation.
5. **Collectivité** : souscription en ligne ou sur devis (bon de commande, mandat administratif) ? Le devis est proposé par défaut.
6. **Logo** : la proposition V88 est à valider ou à faire reprendre par un graphiste.
7. **Témoignages d'élus pilotes** : un emplacement est réservé sur l'accueil (commentaire HTML), à activer après la bêta avec leur accord écrit.
8. **Types de livrables de l'outil de rédaction** (`app.html`) : encore génériques. Il reste à ajouter des cas « préparer une séance », « comprendre un dossier soumis au vote », etc.

### Défauts V87 relevés mais non modifiés

- `dashboard-admin.html` charge `admin-v52.js`, `admin-v53.js` et `admin-v54.js` sans `type="module"` : Vite ne les copie pas dans `dist/`. À vérifier en prod (correctif : les déplacer dans `frontend/public/`).
- Le sélecteur d'indicatif téléphonique de l'inscription est chargé depuis `cdn.jsdelivr.net`, bloqué par la CSP Netlify (repli sur la liste simple).
- Nettoyage possible, non fait pour limiter le risque : `V87PROD.zip` (27 Mo), fichiers `*.deprecated`, et environ 25 scripts de correctifs V53 à V66 qui ne sont plus chargés. On peut les supprimer avec `git rm` après validation de la V88.
