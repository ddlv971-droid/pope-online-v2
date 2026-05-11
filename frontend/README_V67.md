# POPE Online V67 — Réécriture complète Dashboard

## Décision

Après plus de 20 itérations de débogage sur le bug de l'étape 3, une réécriture
propre depuis zéro a été préférée à un énième patch.

## Fichiers fournis

| Fichier | Description |
|---------|-------------|
| `dashboard.html` | Tableau de bord public — réécriture complète |
| `dashboard-private.html` | Tableau de bord privé — réécriture complète |
| `app.html` | Outil IA — inchangé (pas de bug) |
| `app-private.html` | Outil IA privé — inchangé (pas de bug) |

## Ce qui a changé (architecture)

### Avant (V65/V66)
- 6+ scripts JS empilés : `dashboard-v5.js`, `dashboard-v58.js`, `dashboard-v60.js`,
  `dashboard-v61-fix.js`, `pope-v64-step-state-fix.js`, `pope-v65/v66-step3-panel-fix.js`
- Chaque script redéfinissait `window.goStep` en capturant la version précédente
- Des `setTimeout` tardifs dans V64 écrasaient silencieusement les patches V65/V66
- L'étape 3 n'était jamais enrichie car `enrichStep3()` n'était plus dans la chaîne

### Après (V67)
- **Zéro script externe de patch**
- Un seul bloc `<script>` inline dans chaque page
- `goStep()` est défini une fois dans une IIFE, jamais réécrit, jamais dans window au
  sens patchable (closure privée exposée sur window une seule fois)
- La navigation entre panneaux repose **uniquement sur les classes CSS** (`.active`)
  sans aucun `style.display` JS — ce qui élimine les conflits avec les `!important` CSS
- L'enrichissement de l'étape 3 est déclenché directement dans `goStep()` à n===3

## Fonctionnalités conservées

- Navigation 4 étapes (Domaine → Besoin → Documents → Envoi)
- Accordéons de description structurée avec aperçu
- Sélection de domaine avec badge de confirmation
- Draft IA : sélection depuis le localStorage
- Dépôt sécurisé vault
- Upload local de fichiers avec drag & drop
- Récapitulatif étape 4
- Soumission expert / redirect Sur Mesure
- KPIs (conseils disponibles, plan)
- Alertes trial / trial expired / offre gratuite
- Restauration d'état depuis l'URL (?step=, ?from=app)
- Onglets : Mon Besoin, Mes Experts, Sur Mesure, Mon Espace
- Topbar responsive + menu mobile
- Logout

## Déploiement

Remplacer `dashboard.html`, `dashboard-private.html` dans votre dossier `frontend/`
et `frontend/dist/`. Les fichiers `app.html` et `app-private.html` peuvent être
ignorés si vous préférez conserver les versions actuelles.

Supprimer les références aux anciens scripts de patch dans les HTML si vous
souhaitez nettoyer complètement :
- `pope-v64-step-state-fix.js`
- `pope-v65-step3-panel-fix.js`
- `pope-v66-step3-panel-fix.js`
- `dashboard-v58.js`, `dashboard-v60.js`, `dashboard-v61-fix.js`

Ces scripts ne sont **plus chargés** par les nouveaux dashboard.html.
