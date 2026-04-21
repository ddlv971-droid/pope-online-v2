V14 corrige définitivement le renvoi legacy vers popeonlinev1.netlify.app après validation d'un compte en production.

Correctifs :
- nouvelle résolution robuste de l'URL frontend canonique côté backend
- purge des domaines legacy même si une variable explicite contient encore l'ancienne URL
- redirection absolue côté verify.html vers https://pope-online.com en production
- staging et localhost conservés
