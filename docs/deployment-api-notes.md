# Contrats de déploiement vérifiés

Sources consultées le 1er octobre 2026 :

- Vercel : https://vercel.com/docs/rest-api/deployments/create-a-new-deployment et https://vercel.com/docs/deployments
  - Les déploiements REST non-Git nécessitent l’upload préalable des fichiers via l’API de fichiers, puis `POST /v13/deployments` avec les références SHA, la taille, le nom du projet et la cible.
  - Les états de déploiement passent notamment par `QUEUED`, `INITIALIZING`, `BUILDING`, `READY` ou `ERROR`.
- Netlify : https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/
  - Un ZIP peut être envoyé avec `POST /api/v1/sites/{site_id}/deploys` et `Content-Type: application/zip`.
  - L’état peut être suivi par `GET /api/v1/deploys/{deploy_id}` jusqu’à `ready` ou un état d’erreur.
- Cloudflare Pages : https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/create/ et https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
  - L’API Direct Upload utilise `POST /accounts/{account_id}/pages/projects/{project_name}/deployments` avec un manifest multipart et les hashes d’assets.
  - Wrangler reste la voie officielle simplifiée pour envoyer un répertoire pré-buildé.

Conséquence d’architecture : BuildFlow doit générer ou recevoir un bundle statique réellement buildé avant de publier. Un fichier source `page.tsx` seul ne doit pas être présenté comme une application déployée.
