# Importer BuildFlow sur Netlify depuis un téléphone

L’archive contient une application Vite autonome et une Function Express/tRPC. Décompressez-la, puis sélectionnez le dossier racine contenant `package.json` et `netlify.toml` dans Netlify.

Ajoutez au minimum `APP_SESSION_SECRET`, `DATABASE_URL` et une clé de provider IA dans les variables d’environnement. Dans le dépôt configuré, le build de production applique automatiquement les migrations Drizzle après un préflight des doublons d’adresses e-mail; les Deploy Previews ne modifient pas Aiven.

Pour une base de développement locale uniquement, appliquez manuellement le journal :

```bash
pnpm db:migrate
```

Ne mettez jamais de fichier `.env` ni de secret dans l’archive ou GitHub.
