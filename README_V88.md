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

### Accueil animé (V88.1)

L'échange question d'élu / réponse d'expert de l'accueil est désormais animé. La séquence raconte le parcours d'une question :
1. l'élu pose sa question ;
2. elle est envoyée, puis confiée à un expert du domaine (le trait de suivi se remplit) ;
3. la réponse signée apparaît, avec le délai réel, toujours sous 24 h.

Trois exemples défilent : budget, personnel communal, marchés publics.

- **Une seule séquence orchestrée**, sans effet de machine à écrire ni de « chat », pour ne pas évoquer l'IA.
- **Démarrage** quand l'échange devient visible à l'écran.
- **Pause** au survol, au focus clavier et quand l'onglet est masqué.
- **Contrôles** : boutons pour choisir l'exemple, bouton Pause / Lecture.
- **Accessibilité** : si le visiteur a demandé de réduire les animations (réglage système), l'échange s'affiche directement, sans mouvement. Sans JavaScript, le premier exemple reste lisible.
- **Fichiers concernés** : `frontend/index.html`, `frontend/site-v88.css`.

### Fonds de page, filigrane et premier écran (V88.2)

- **Filigrane pleine page sur l'accueil** : l'arbre POPE, fixe derrière tout le contenu, très discret (environ 4,5 % d'opacité). Il reste en place pendant le défilement.
- **Fonds harmonisés sur tout le site** :
  - même papier légèrement grainé (texture vectorielle, sans image externe) ;
  - deux halos doux, vert lichen en haut à droite et sable en bas à gauche ;
  - sections transparentes ou voilées de blanc, pour que le fond respire ;
  - appel final en sapin profond, avec un halo.
- **Pages secondaires** (Pour les élus, Tarifs, Qui sommes-nous) : rappel de l'arbre en trait fin dans le bandeau.
- **Espace connecté** : même papier, mêmes halos, même filigrane. La barre supérieure passe du quasi-noir au sapin profond, avec le nouveau pictogramme (`assets/pope-mark-light.png`).
- **Bandeau défilant** des sujets, en défilement continu et sans à-coup :
  - dix sujets en typographie à empattements, séparés par le « fruit » ocre de l'arbre ;
  - bords fondus ;
  - pause au survol ;
  - liste fixe si le visiteur a demandé de réduire les animations.
- **Premier écran plein écran** dès l'arrivée sur le site :
  - sur ordinateur, l'accroche, l'échange animé et le bandeau occupent exactement la hauteur de l'écran (vérifié en 1366×768, 1440×900 et 1920×1080) ;
  - sur mobile et tablette, le premier écran réunit l'accroche et le bandeau, et l'échange animé suit au premier défilement.
- **Fichiers concernés** : `frontend/index.html`, `frontend/site-v88.css`, `frontend/public/theme-v88.css`, `frontend/assets/pope-mark-light.png`, et les 11 pages connectées dotées de la barre supérieure.

### Visage humain de l'accueil (V88.3)

La photo fournie (une élue au téléphone, en surimpression sur la ville) est incrustée à gauche du premier écran. Elle exploite toute la largeur de la page, comme l'ancienne version.

- **Fusion avec le fond** : la photo part du bord gauche de l'écran. Un mode de fusion « multiply » transforme son voile blanc en papier de la page, et un dégradé la fait disparaître vers la droite. Sa saturation est légèrement réduite pour s'accorder à la palette.
- **Ordinateur** : l'accroche et l'échange animé se décalent vers la droite. Le premier écran reste en plein écran, bandeau défilant compris. Vérifié en 1280×720, 1366×768 et 1920×1080.
- **Mobile et tablette** : la photo forme un bandeau fondu en tête du premier écran, au-dessus de l'accroche. Le bandeau défilant reste visible dès l'arrivée.
- **Fichier** : `frontend/assets/pope-visage-humain.jpg` (1280×891, 95 Ko, optimisé).
- **À vérifier** : les droits d'utilisation de la photo (licence de banque d'images ou cession), pour un usage commercial sur le site.

### Pages de connexion et d'inscription (V88.4)

Le panneau gauche des pages de connexion et d'inscription reprend le visage humain de l'accueil, comme l'image de fond de l'ancienne version.

- **Traitement** : la photo est passée en camaïeu sapin (légèrement désaturée), sous un voile vert qui s'intensifie vers la droite.
- **Ordinateur** : le visage est visible à gauche. La marque, l'accroche et les arguments se placent sur la partie droite, à l'écart du visage, avec des encarts translucides.
- **Mobile** : le panneau devient un bandeau compact, avec la marque et l'accroche sur la photo. Le formulaire apparaît immédiatement en dessous. Le doublon du logo mobile est masqué.
- **Pages concernées** : toutes celles qui utilisent ce panneau (connexion, inscription élu, inscription privée en veille, essai).
- **Fichiers** : `frontend/public/theme-v88.css` et `frontend/public/images/pope-visage-humain.jpg`. Cette copie de la photo est servie telle quelle, pour être utilisable depuis le thème.

### Connexion et inscription, correctifs des compteurs (V88.4)

**Pages de connexion et d'inscription**
- Le panneau gauche reprend la photo « visage humain » de l'accueil, teintée sapin, comme sur l'ancienne version (`login.html`, `signup-public.html`, `signup-private.html`).
- Le visage reste perceptible à gauche ; le texte, au centre, est sur un voile plus dense pour rester lisible.
- Sur mobile, la photo forme un bandeau en haut de page.

**Compteur de Conseils Expert à 10 001**
- *Cause* : des comptes conservaient la valeur sentinelle `tickets_expert = 9999` de la V87. La V88 compte ce champ comme des crédits achetés, d'où 2 (quota d'essai) + 9 999 = 10 001. La remise à plat du patch V89 ne s'était pas appliquée à ces comptes, probablement parce que l'API démarre sans passer par `npm start`, donc sans `db_init`.
- *Corrections* :
  1. toute valeur ≥ 1 000 est ignorée côté API (affichage et décompte) ;
  2. le patch V89 contient désormais une remise à zéro permanente de ces valeurs (vérifiée : les vrais crédits sont conservés) ;
  3. l'API rejoue le patch V89 à chaque démarrage, quelle que soit la commande Render.
- Le tableau de bord affiche « ∞ » pour les offres illimitées.

**Tickets IA (outil de rédaction)**
- Chaque génération décrémentait la valeur « illimitée » (9999 → 9998…), et les comptes réinscrits ou résiliés gardaient un accès incohérent.
- *Désormais* :
  - accès inclus pendant l'essai et dans les offres actives, sans aucun décompte quand l'accès est illimité ;
  - refus clair sinon : « essai terminé », « e-mail à confirmer » ou « offre à souscrire » ;
  - la résiliation retire l'accès.
- La bannière de l'outil de rédaction annonçait encore « l'outil reste disponible » après l'essai : texte corrigé.

**Admin**
- Changer le nombre de tickets d'un compte remettait silencieusement son offre en FREE, son quota à 2, et ainsi de suite. La mise à jour est désormais **partielle** : seuls les champs modifiés changent.
- Le champ « Tickets » devient « Conseils Expert à l'unité » : il ajoute ou retire des crédits (ex. `1` ou `-1`).
- Changer d'offre applique le quota du catalogue et remet le compteur du mois à zéro.

### Espace « Mon compte » (V88.5)

- La carte « Tickets IA » est retirée de l'onglet Abonnement (`profile.html`). Elle n'apportait rien à l'élu, et l'outil de rédaction n'est plus mis en avant.
- La carte restante devient « Conseils Expert disponibles » et affiche « ∞ » pour les offres illimitées. La grille de cartes se réorganise d'elle-même sur quatre colonnes.
- Les statuts « Résilié » et « Sans essai » ont désormais un libellé lisible.
- La valeur IA reste consultable dans le tableau de bord admin, pour usage interne.

### Incarner l'expertise et lever les freins à l'achat (V88.6)

Cette version répond à la note *Analyse critique du site du point de vue des élus* (3 octobre 2026).

**1. Donner un visage à l'expertise**
- **Profils** : cinq profils d'experts anonymisés, construits à partir des CV de l'équipe (finances locales, urbanisme, management et dialogue social, déontologie et contrôle, audit et fonds européens), plus une carte « Et aussi, +30 experts ». Ils figurent sur l'accueil (« Qui vous répond ? ») et sur la page Qui sommes-nous.
  - Anonymisation : ni noms ni photos. Les employeurs exacts sont généralisés.
  - Une mention explique pourquoi les noms ne sont pas publiés : l'indépendance vis-à-vis des collectivités conseillées.
- **Exemple de Conseil Expert téléchargeable** : `frontend/public/docs/exemple-conseil-expert-urbanisme.pdf`, 5 pages. Une adjointe d'une commune de 15 000 habitants interroge sur un permis contesté alors que le PLU est en révision. Le document comprend :
  - une synthèse ;
  - le droit applicable, avec ses articles ;
  - l'analyse et les options ;
  - le calendrier ;
  - une trame d'arrêté de sursis ;
  - des éléments de langage pour les riverains ;
  - une liste de vérifications.
- **Témoignages** : six témoignages, dont trois nuancés. Trois figurent sur l'accueil, les six sur la page élus.
  - Ils sont présentés **à titre d'illustration**, avec une mention visible.
  - `showTestimonials: false` dans `site-config.js` les masque partout.

**2. Offre Commune (moins de 10 000 habitants)**
- **Prix proposé** : 149 € HT/mois pour 3 comptes, +25 € par compte jusqu'à 5, soit 199 €. 10 Conseils Expert par mois et par compte. Ce prix est **à valider**.
- **Circuit d'achat public** : devis, bon de commande, facture Chorus Pro, mandat administratif, avec la mention du seuil de l'article R.2122-8 du code de la commande publique.
- **Côté technique** : plans `COMMUNE_M` / `COMMUNE_A` au catalogue et dans l'admin. Les comptes sont activés manuellement par l'admin après le bon de commande.

**3. Urbanisme**
- Ajouté sur l'accueil (quatre sujets prioritaires, dans l'ordre de l'enquête), dans le bandeau défilant et parmi les exemples de questions.
- Ajouté aussi dans les domaines du tableau de bord, en domaine prioritaire, et parmi les profils d'experts.

**4. Au-delà du municipal**
- Profil « Élus intercommunaux, départementaux et régionaux », avec ou sans délégation.
- Section « Élus d'outre-mer » : collectivités uniques, octroi de mer, fonds européens, délai à l'heure locale, rappel sur les horaires locaux.

**5. Neutralité**
- Nouvelle page `deontologie.html` (charte en 8 engagements), reliée au pied de page, à la FAQ et à la page élus.
- Formulation neutre pour les conseillers municipaux : « poser les bonnes questions en séance ».

**6. Promesses précisées**
- Délai : « 24 h ouvrées », vendredi soir → lundi, heure locale en outre-mer, Conseil Expert non décompté en cas de dépassement.
- « Expert désigné, même interlocuteur pour un dossier » remplace « expert dédié ».
- Incohérence corrigée : 2 Conseils Expert offerts partout.
- Nouvelles questions de FAQ : assurance, hébergement et RGPD, opposition, usage raisonnable.

**7. Objection de l'IA gratuite**
- Tableau comparatif « IA généraliste / Conseil Expert » sur la page élus.
- Glossaire (Conseil Expert, Clausier, Dépôt sécurisé, Outil de rédaction) sur la page Tarifs.

**8. Calendrier électoral**
- Section « Nouvel élu ? Votre première année de mandat » sur la page élus.

**9. Conversion**
- « Parler à un conseiller » ouvre un formulaire : rappel, rendez-vous visio, devis Commune ou Collectivité, avec un créneau souhaité.
- Il remplace le lien téléphonique, inopérant sur ordinateur. Le lien « Contact » du menu ouvre le même formulaire.
- **Côté technique** :
  - nouvelle route API `POST /contact` (anti-robots, limite de 8 envois par heure) ;
  - chaque demande est enregistrée (table `contact_requests`, patch `schema_patch_v90.sql`), envoyée par e-mail à `MAIL_TO` et confirmée par e-mail au demandeur ;
  - `bookingUrl` dans `site-config.js` ajoute un lien d'agenda en ligne (Calendly, Cal.com…) si vous en avez un.
- Clause d'usage raisonnable ajoutée sur l'offre Collectivité.

**À valider avant la mise en production (affirmations ajoutées au site)**
- [ ] Prix et contenu de l'offre Commune.
- [ ] Engagement « Conseil Expert non décompté si le délai de 24 h ouvrées est dépassé ».
- [ ] Rappel sur les horaires locaux d'outre-mer.
- [ ] **Assurance responsabilité civile professionnelle** : la FAQ l'affirme ; vérifier l'attestation.
- [ ] **Hébergement dans l'Union européenne** : la FAQ l'affirme ; vérifier la région Render de l'API et de la base, ainsi que le stockage des pièces.
- [ ] Engagements de la charte de déontologie (cloisonnement, déport des experts), à faire approuver par les associés et accepter par chaque expert.
- [ ] Accord des cinq experts sur la publication de leur profil anonymisé.
- [ ] **Témoignages** : les remplacer par ceux des élus de la bêta, avec leur accord écrit. Publier comme réels des avis inventés constituerait une pratique commerciale trompeuse (Code de la consommation).
- [ ] **Cadre juridique** : les Conseils Expert comportent une part de conseil juridique, activité réglementée (loi du 31 décembre 1971, art. 54 et suivants). Faire vérifier par un avocat les conditions dans lesquelles les experts peuvent la délivrer.
- [ ] Recruter un expert « statut de la fonction publique territoriale » : premier besoin des élus (50 %), absent des cinq profils actuels.

### Mobile d'abord (V88.7)

Les élus consulteront le site à 80 % sur téléphone. Le site vitrine a été revu en portrait, et vérifié en 390 et 412 px de large (iPhone, Galaxy) :

- **Bouton menu** :
  - ses dimensions sont verrouillées : Samsung Internet l'étirait sur la moitié de l'écran ;
  - l'icône se transforme en croix à l'ouverture.
- **Menu plein écran** : grandes entrées, page en cours repérée, bouton « Tester gratuitement » en bas, page figée derrière le menu, fermeture par Échap.
- **Barre d'action collante** :
  - « Tester gratuitement » et « Rappel » ;
  - elle apparaît après le premier écran et s'efface sur l'appel final et le pied de page ;
  - elle tient compte des encoches et de la barre système (`safe-area`).
- **Carrousels à faire glisser**, avec points de repère, pour les profils d'experts, les témoignages et les offres. La page Tarifs s'ouvre directement sur l'offre Élu, ce qui divise la longueur de la page d'accueil par deux.
- **Comparatif IA / expert** : il devient des cartes empilées, sans défilement horizontal.
- **Échange animé** : onglets sur une ligne, défilants.
- **Boutons** : pleine largeur, 52 px de haut.
- **Formulaire de contact et souscription** : ils s'ouvrent en feuille depuis le bas de l'écran. Les champs font au moins 16 px, ce qui évite le zoom automatique de Safari sur iPhone.
- **Bandeau cookies** : en feuille, boutons empilés.
- **Pied de page** : liens espacés pour le doigt.
- **Espace connecté** : onglets du tableau de bord défilants, signature de la barre supérieure masquée sur petit écran, champs à 16 px.

### Correctif menu mobile (V88.8)

**Symptôme.** Sur mobile, le menu restait affiché par-dessus la page d'accueil, même fermé.

**Cause.** Depuis la V88.6, le formulaire de contact importait `api.js`. Vite rangeait alors le code des pages vitrine dans un morceau commun auquel est rattachée la feuille de style de l'espace connecté (`app.css`, 245 Ko). Une règle de cette feuille (`nav { display: flex }` sous 768 px) forçait l'affichage du menu.

**Corrections.**
1. Le formulaire de contact appelle l'API sans importer `api.js`.
2. Le polyfill Vite est isolé dans son propre morceau (`vite.config.js`).
3. Un garde-fou CSS fait qu'un menu fermé reste caché, quelle que soit la feuille de style chargée.

Les pages vitrine ne chargent plus `app.css`, ce qui les rend nettement plus légères sur mobile. Vérifié sur le build : à l'ouverture le menu est caché, il s'ouvre puis se referme au toucher, et il se referme quand on choisit un lien.

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
