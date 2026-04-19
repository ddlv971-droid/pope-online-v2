POPE Online — Correctifs V6

Cette version répare et améliore :
- l’archivage automatique par appareil et par utilisateur
- l’archivage manuel de la génération en cours
- la vérification réelle de disponibilité du stockage local
- l’animation visuelle pendant la génération pour éviter les doubles clics
- le verrouillage temporaire du bouton de génération pendant l'appel IA

Fichiers modifiés :
- frontend/archive.js
- frontend/app.html
- frontend/app.css

Comportement attendu :
- la case "Archiver automatiquement chaque génération sur cet appareil" est cochable et mémorisée
- le bouton "Archiver cette génération" enregistre bien le résultat courant
- en cas d'indisponibilité du stockage local, l'archivage se désactive sans casser la génération ni la déconnexion
- pendant la génération, un indicateur animé apparaît et le bouton devient inactif jusqu'à la fin du traitement
