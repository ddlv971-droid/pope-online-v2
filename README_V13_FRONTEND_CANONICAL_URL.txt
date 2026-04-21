V13 - Correctif lien de validation de compte

Objet du correctif
- Les e-mails de validation pouvaient pointer vers une URL Netlify si FRONTEND_BASE_URL était resté configuré sur Netlify en production.

Correctifs intégrés
- Le backend privilégie désormais FRONTEND_CANONICAL_URL ou PUBLIC_APP_URL si l'une de ces variables est définie.
- Si FRONTEND_BASE_URL contient une URL Netlify mais que CORS_ORIGIN contient pope-online.com, le backend force automatiquement la génération des liens vers pope-online.com.
- Le même correctif a été appliqué aux liens de satisfaction.

Variables recommandées en production
- FRONTEND_BASE_URL=https://pope-online.com
- FRONTEND_CANONICAL_URL=https://pope-online.com
- CORS_ORIGIN=https://pope-online.com,https://www.pope-online.com
