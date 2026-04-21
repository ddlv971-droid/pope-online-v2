V16 corrige le flux responsive sur les parcours Génération d’un livrable, Relecture experte et Accompagnement sur mesure.

Correctifs principaux :
- la page de connexion respecte désormais le paramètre ?next=... et renvoie l’utilisateur vers le parcours demandé après authentification ;
- validation du next pour éviter les redirections incohérentes entre espace public et espace privé ;
- la déconnexion renvoie désormais vers la bonne page d’entrée (public.html ou private.html) selon l’espace courant ;
- ajout d’un vrai menu burger responsive sur les pages protégées afin que les actions Connexion/Déconnexion, Dépôt sécurisé, Relecture et Génération restent accessibles sur mobile.
