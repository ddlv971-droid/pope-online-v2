# POPE Online V89.6 — Gestion des profils et des assignations (administration)

Complète les V89 à V89.5 (voir les README correspondants).

## Profils

| Profil | Qui | Où il apparaît | Ce qu'il peut faire |
| --- | --- | --- | --- |
| Client | **toute nouvelle inscription** (et tout compte créé depuis « Créer un compte ») | Clients | espace élu |
| Expert | profil attribué par un administrateur | Équipe › Experts | espace expert, portefeuille de clients |
| Conseiller | profil attribué par un administrateur | Équipe › Conseillers | se connecte à l'administration, **onglet Rendez-vous seulement** |
| Administrateur | profil attribué par un administrateur | Équipe › Administrateurs | tout le tableau de bord |

- Le patch V95 fixe la valeur par défaut du profil à « client » et remet en « client »
  les anciens comptes au profil vide ou « user ».
- Changer de profil : depuis la page de chaque profil (menu « Profil » sur la carte) ou
  depuis la fiche d'un compte (onglet Actions). Garde-fous : impossible de retirer ses
  propres droits ; il reste toujours au moins un administrateur.
- Effets d'un changement : un expert qui change de profil libère son portefeuille ; un
  client qui rejoint l'équipe sort des portefeuilles ; un membre repassé client voit ses
  rendez-vous à venir revenir « sans conseiller ».
- Correction au passage : l'ancien bouton « Appliquer » du profil effaçait le nom et la
  collectivité du compte. Il utilise désormais une route dédiée qui ne touche qu'au
  profil.

## Pages de l'équipe (menu « Équipe »)

- **Experts** : indicateurs (experts, clients suivis, clients sans expert, clients au
  total), liste des **clients sans expert** (ceux qui ont une demande en cours d'abord)
  avec « Confier à… » en un clic, carte de chaque expert avec son portefeuille (demandes
  en cours ou traitées, retrait d'un client), ajout d'un client au portefeuille, ajout
  d'un expert à partir d'un compte existant. Pastille du nombre de clients sans expert
  dans le menu.
- **Conseillers** : charge de chacun (rendez-vous à venir, prochain rendez-vous,
  terminés sur 30 jours, barre de charge), « Voir ses rendez-vous », bouton
  « Répartir les rendez-vous sans conseiller » (au moins chargé d'abord).
- **Administrateurs** : liste, dernière connexion, ajout.
- **Clients** : la liste ne montre plus que les clients ; sous chaque nom, son expert
  référent ou « Sans expert ». La fiche client a un bloc « Experts référents » (ajout,
  retrait).

## Rendez-vous

- Liste « Avec » regroupée : Conseillers, Experts, Administrateurs, avec la charge de
  chacun entre parenthèses.
- Bouton « Répartir les rendez-vous sans conseiller » (administrateurs).
- **Espace conseiller** : un conseiller se connecte avec ses identifiants sur
  `dashboard-admin.html` (ou depuis la page de connexion, qui l'y envoie). Il voit
  « Mes rendez-vous » par défaut, peut afficher les rendez-vous non attribués et
  « Je le prends », confirme, reporte, note et clôt ses rendez-vous. Les rendez-vous
  des autres conseillers sont en lecture seule. Il n'a accès à aucun autre onglet ni à
  aucune autre donnée (contrôlé côté serveur).

## API

| Route | Accès | Rôle |
| --- | --- | --- |
| `GET /admin/team-overview` | admin | experts et portefeuilles, conseillers et charge, administrateurs, clients sans expert |
| `PATCH /admin/users/:id/role` | admin | changer le profil (`client`, `expert`, `conseiller`, `admin`) |
| `GET /staff/appointments` | admin, conseiller | rendez-vous (remplace `/admin/appointments`) |
| `PATCH /staff/appointments/:kind/:id` | admin, conseiller | mise à jour (conseiller : ses rendez-vous ou non attribués, attribution à lui-même seulement) |
| `POST /staff/appointments/auto-assign` | admin | répartition des rendez-vous sans conseiller |
| `GET /staff/team` | admin, conseiller | équipe et charge |

Les assignations client ↔ expert utilisent les routes existantes
`POST` / `DELETE /admin/expert-assignments`.

## Base de données

`backend/db/schema_patch_v95.sql` (idempotent, appliqué par `db_init.js` et au
démarrage) : valeur par défaut « client », normalisation des profils, index.

## Fichiers

| Fichier | Statut |
| --- | --- |
| `frontend/admin-team.js` | nouveau : pages Experts, Conseillers, Administrateurs, bloc « Experts référents » |
| `frontend/admin-rdv.js` | rendez-vous : routes /staff, liste groupée, répartition, espace conseiller |
| `frontend/dashboard-admin.html` | menu Équipe, démarrage selon le profil, liste des clients, fiche client |
| `frontend/login.html` | un conseiller est dirigé vers l'administration |
| `backend/routes/team.js` | nouveau |
| `backend/routes/appointments.js` | routes /staff, règles conseiller, répartition |
| `backend/routes/auth.js` | connexion administration ouverte aux conseillers |
| `backend/routes/admin.js` | profil « conseiller » accepté |
| `backend/middleware/auth.js` | `requireStaff` |
| `backend/db/schema_patch_v95.sql` | nouveau |

## Tests réalisés

API réelle sur PostgreSQL local (schéma complet) : nouveau compte créé en client,
passage en conseiller, refus de se retirer ses droits, assignation, vue d'ensemble,
anciens profils « user » normalisés, conseiller refusé sur `/admin/users`, conseiller
qui prend un rendez-vous libre, refus d'attribuer à un autre, refus de modifier le
rendez-vous d'un autre, répartition refusée au conseiller et effectuée par
l'administrateur, expert repassé client (portefeuille et rendez-vous libérés).
Interface réelle (administrateur puis conseiller) : liste des clients, pastilles, pages
Experts / Conseillers / Administrateurs, « Confier à… », fiche client, liste « Avec »
groupée, vue conseiller limitée à « Mes rendez-vous », aucune erreur JavaScript.
