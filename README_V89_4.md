# POPE Online V89.4 — Page diagnostic plus chaleureuse, accueil plus premium

Complète les V89 à V89.3 (voir les README correspondants). Même charte : sapin,
lichen, ocre en touche, Source Serif 4 et Public Sans.

## 1. Page du diagnostic

Le filigrane centré de la V89.3 est retiré. À la place, un bandeau vert sapin en haut
de page, avec l'arbre de la marque en grand, très pâle, à droite. La carte du
diagnostic vient se poser sur ce bandeau, avec une ombre plus profonde. Au-dessus de
la carte : le pictogramme arbre, « Diagnostic flash » et « Gratuit, confidentiel,
calculé sur votre appareil ». Le bandeau est masqué à l'impression.
Styles : bloc V89.4 de `frontend/diagnostic.css`.

## 2. Accueil, après le bandeau déroulant

- **Quatre sujets** : titre et introduction à gauche, avec un lien vers « Pour qui ? » ;
  à droite, les quatre sujets séparés par des filets fins, chacun avec un pictogramme au
  trait.
- **Comment ça marche ?** : devient une bande vert sapin (le moment fort de la page),
  avec l'arbre de la marque en filigrane, les trois étapes avec de grands chiffres ocre
  clair, et les quatre engagements (24 h, 15 jours, 100 %, +30) réunis en bas de la
  même bande. L'ancienne bande de chiffres séparée disparaît.
- **Qui vous répond ?** : titre et texte en deux colonnes ; les silhouettes grises sont
  remplacées par le pictogramme du domaine de chaque expert (finances, urbanisme,
  gouvernance, déontologie, audit) ; cartes plus aérées.
- **Exemple de Conseil Expert** : document plus grand, en pile de trois feuilles, avec
  le titre et l'encadré « En bref » ; titre de section plus grand et trois points qui
  décrivent le contenu réel du PDF.
- **Témoignages** : citations sans cadre, séparées par des filets, auteur souligné d'un
  petit trait vert.

Styles : bloc V89.4 en fin de `frontend/site-v88.css` (classes `h-*`), sans effet sur
les autres pages.

## Fichiers

`frontend/index.html`, `frontend/site-v88.css`, `frontend/diagnostic.html`,
`frontend/diagnostic.css`, `frontend/diagnostic.js` (titre d'accueil du diagnostic),
`frontend/public/site-config.js` (version `V89.4`), `backend/server.js`
(`/health` → `v89.4`).

## Tests réalisés

Site compilé (`vite build`), Chromium ordinateur et mobile : accueil complet, page du
diagnostic (accueil et questions), parcours complet du diagnostic et prise de
rendez-vous, fenêtre « Parler à un conseiller », aucune erreur JavaScript, aucun
débordement horizontal.
