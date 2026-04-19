Correctif V4 — Archivage premium stabilisé

Cette version corrige le blocage introduit par la précédente intégration d’archivage.

Correctifs appliqués :
- correction complète du module frontend/archive.js
- suppression de l’erreur JavaScript qui bloquait toute la page app.html
- sécurisation du chargement du module d’archivage dans app.html
- maintien du fonctionnement de la génération et de la déconnexion même si l’archivage devient indisponible
- correction de la sélection multiple dans la liste d’archives
- désactivation propre de l’interface d’archivage en cas d’erreur locale navigateur

Fichiers corrigés :
- frontend/archive.js
- frontend/app.html
- frontend/app.css

Résultat attendu :
- le bouton “Produire un livrable sécurisé” refonctionne
- le bouton “Déconnexion” refonctionne
- l’archivage premium reste disponible sans casser le reste de l’application
