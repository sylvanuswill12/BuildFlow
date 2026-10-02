# BuildFlow sur Netlify

Cette version contient une configuration Netlify prête à l’emploi : `netlify.toml` publie `dist/public` et redirige `/api/*` vers `netlify/functions/api.ts`.

Depuis un téléphone, décompressez l’archive puis importez le dossier principal dans **Netlify → Add new project → Deploy manually**. Le dossier importé doit contenir `package.json`, `pnpm-lock.yaml`, `netlify.toml`, `client/`, `server/`, `drizzle/`, `shared/` et `netlify/`.

Dans Netlify, ajoutez ensuite les variables d’environnement correspondant à votre base de données, à l’authentification et au fournisseur IA. Ne placez aucun secret dans l’archive.

Consultez `docs/netlify-mobile.md` pour les étapes détaillées et les limites de l’hébergement serverless.
