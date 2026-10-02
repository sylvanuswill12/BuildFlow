# Importer BuildFlow sur Netlify depuis un téléphone

Cette archive est préparée pour Netlify. Elle contient `netlify.toml`, une Function API dans `netlify/functions/api.ts` et une configuration Vite qui publie `dist/public`.

## Import

1. Téléchargez l’archive `buildflow-netlify-ready.zip`.
2. Décompressez-la avec l’application Fichiers du téléphone.
3. Ouvrez Netlify et choisissez **Add new project → Deploy manually** ou ouvrez [Netlify Drop](https://app.netlify.com/drop).
4. Sélectionnez le dossier principal décompressé, celui qui contient `package.json` et `netlify.toml`. Ne sélectionnez pas uniquement `client` ou `dist`.
5. Si Netlify Drop ne permet pas de sélectionner un dossier sur votre téléphone, utilisez le menu du navigateur **Version pour ordinateur**, ou importez l’archive par l’interface **Deploy manually**.

Pour un import GitHub ultérieur, le contenu décompressé doit être envoyé avec sa structure complète. Les dossiers `client`, `server`, `drizzle`, `shared`, `netlify` et `docs` doivent rester à la racine du projet.

## Variables Netlify

Dans **Site configuration → Environment variables**, ajoutez au minimum les variables nécessaires à votre environnement : `DATABASE_URL`, les variables du provider IA et les variables OAuth. Pour l’auto-publication Netlify depuis BuildFlow, ajoutez aussi `NETLIFY_AUTH_TOKEN` et `NETLIFY_SITE_ID`.

Ne mettez jamais de fichier `.env` ou de secret dans l’archive ou GitHub.

## Limite importante

Netlify peut héberger le frontend et les routes API via la Function. Les fonctionnalités de production nécessitent toutefois une base MySQL accessible depuis Internet, les secrets IA/OAuth correspondants et leurs URLs publiques. La migration Drizzle doit être exécutée sur la base avant la première utilisation :

```bash
pnpm db:migrate
```
