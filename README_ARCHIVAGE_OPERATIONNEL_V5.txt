POPE Online — Correctif archivage opérationnel V5

Cette version reprend la bêta jointe et rend l’archivage local réellement opérationnel sans casser la génération ni la déconnexion.

Correctifs appliqués :
- sécurisation complète du stockage local dans frontend/archive.js
- détection de disponibilité réelle du localStorage
- désactivation propre de l’UI archivage si le navigateur bloque le stockage
- sauvegarde automatique mémorisée par utilisateur
- branchement robuste de l’archivage lors de la génération IA
- maintien du fonctionnement de la génération et de la déconnexion même si l’archivage devient indisponible

Fichiers modifiés :
- frontend/archive.js
- frontend/app.html

Utilisation :
- Produire un livrable sécurisé
- cocher “Archiver automatiquement...” pour que chaque génération soit conservée
- ou cliquer sur “Archiver cette génération” pour un archivage manuel
- utiliser la zone “Archivage local de mes générations” pour retrouver, filtrer, réouvrir, exporter et supprimer les archives
