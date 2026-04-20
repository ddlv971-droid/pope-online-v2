POPE Online V4 – Correctif responsive/mobile

Cette version corrige la perte de session observée sur mobile/responsive lors du lancement d'un livrable, d'une relecture experte ou d'une demande sur mesure.

Correctifs appliqués :
- maintien du cookie HttpOnly existant
- ajout d'un jeton de secours en sessionStorage côté frontend
- envoi automatique d'un header Authorization Bearer quand le cookie cross-site n'est pas renvoyé par certains navigateurs mobiles
- synchronisation des pages login, vérification e-mail et admin-login avec ce nouveau mécanisme
- conservation de credentials: include pour garder le fonctionnement desktop et cookie-first

Ce correctif vise à fiabiliser la session sur mobile tout en conservant le socle V3 existant.
