# POPE Online V62.5 — correction propre navigation + étape 3

Base : V61 full patch.

Correctifs appliqués :
- correction de l’erreur JavaScript `Unexpected identifier besoin` dans dashboard/dashboard-private ;
- correction de l’erreur `Unexpected token <` dans app/app-private ;
- moteur final de navigation injecté en dernier, sans reconstruire artificiellement l’étape 3 ;
- clic étape 1 → étape 2, étape 2 → étape 3, étape 3 → étape 4 stabilisé ;
- retour depuis app/app-private forcé vers dashboard correspondant en `?from=app&step=2&attach=last` ;
- retrait automatique du style anti-flash qui pouvait masquer tous les panels ;
- conservation des composants natifs de l’étape 3 : draft IA, dépôt sécurisé, liste vault ;
- export sécurisé de `renderStep3` et `renderStep4` pour permettre au moteur final de les appeler.

Aucune modification backend.
