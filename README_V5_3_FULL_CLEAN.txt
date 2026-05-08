POPE Online — V5.3 full clean

Correctifs principaux :
1. Dashboard admin : sauvegarde fiche client en BDD renforcée.
   - Route /admin/client-fiche/:userId fiabilisée.
   - Création automatique des colonnes/tables manquantes au besoin.
   - Message d'erreur détaillé côté admin si la BDD n'est pas à jour.

2. Dashboard admin : fiche client + experts & portefeuilles synchronisés.
   - Email et téléphone séparés.
   - Champ Responsable POPE assigné relié à une liste déroulante des experts.
   - Validation de l'assignation depuis la fiche.
   - L'assignation alimente expert_assignments afin que l'expert voie les requêtes du client.
   - Si un expert est déjà assigné via Experts & portefeuilles, il est affiché dans la fiche.

3. Dashboard public / privé : parcours besoin expert nettoyé.
   - Suppression des boutons header Générer et Conseil Expert.
   - Aides optionnelles intégrées à la description complète.
   - Bloc Nature du traitement attendu reconstruit et corrigé visuellement.
   - Étape documents alimentée avec les drafts préparés dans app.html / app-private.html.

4. app.html / app-private.html : raccordement au parcours dashboard.
   - Suppression de la logique de sortie vers Conseil Expert / Sur mesure.
   - Ajout d'un bouton Retour parcours.
   - Sauvegarde locale du draft généré pour le rattacher ensuite à la demande expert.

À exécuter dans PostgreSQL avant test :
\i backend/db/schema_patch_v53_full_clean.sql

Test conseillé :
1. Déployer backend staging Render.
2. Exécuter le patch SQL.
3. Déployer frontend staging Netlify.
4. Tester : création demande client -> génération draft optionnel -> retour dashboard -> joindre draft -> soumettre -> admin -> fiche -> assigner expert -> expert dashboard.
