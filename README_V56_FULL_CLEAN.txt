POPE Online V56 full clean

Correctifs principaux :
- correction front de l'erreur selectedUser is not defined sur dashboard-admin ;
- sauvegarde fiche client via /admin/client-fiche/:userId avec message d'erreur détaillé ;
- patch SQL consolidé backend/db/schema_patch_v56_full_clean.sql ;
- suppression visuelle des anciens accès Générer / Conseil Expert dans les headers ;
- badge du domaine d'expertise conservé à l'étape 2 ;
- refonte du bloc Description complète avec champs structurés ;
- refonte du bloc Nature du traitement attendu ;
- continuité dashboard -> app -> dashboard sans perte d'étape ;
- sauvegarde locale des drafts générés et disponibilité dans la liste de l'étape Documents.

Avant test :
psql "$DATABASE_URL" -f backend/db/schema_patch_v56_full_clean.sql

À vérifier dans Render/Netlify :
- CORS_ORIGIN inclut l'URL Netlify staging et production ;
- le JWT admin est bien présent côté navigateur ;
- les utilisateurs experts existent avec un identifiant UUID valide.
