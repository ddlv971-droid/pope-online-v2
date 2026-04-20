V9 — Intelligence dossier

Nouveautés :
- OCR des PDF scannés avec fallback gracieux
- résumé automatique multi-documents
- scoring qualité dossier
- extraction intelligente des dates, montants et acteurs
- affichage d'une analyse de dossier dans l'interface de génération

Important :
- les PDF textuels sont lus directement
- les PDF scannés passent par OCR si python3 + tesseract + poppler sont disponibles sur le serveur
- si l'environnement ne dispose pas des binaires OCR, le site ne casse pas : le système retombe sur l'extraction texte standard
