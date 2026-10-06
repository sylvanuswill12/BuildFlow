# Migration vers une installation autonome

## Ce qui a changé

- L’authentification est désormais **locale** : inscription et connexion par email/mot de passe, mots de passe hachés avec scrypt, sessions JWT HTTP-only signées par `APP_SESSION_SECRET`.
- L’application n’expose plus de configuration runtime propriétaire, de collecteur de débogage dédié, de proxy de stockage, de proxy IA, ni de routes d’authentification tierces.
- La génération utilise directement des fournisseurs standards configurés par l’exploitant : OpenAI, Gemini, OpenRouter, Groq, DeepSeek, Mistral, Ollama ou une API compatible OpenAI.
- Les cartes utilisent désormais `VITE_GOOGLE_MAPS_API_KEY` directement lorsqu’elles sont activées.
- Les intégrations Stripe, Supabase, Sentry, Vercel, Netlify et Cloudflare restent facultatives et indépendantes.

## Variables indispensables

```env
APP_SESSION_SECRET=secret-aleatoire-d-au-moins-32-caracteres
DATABASE_URL=mysql://user:password@host:3306/buildflow
OPENAI_API_KEY=...
```

Ajoutez éventuellement `ADMIN_EMAILS=admin@example.com` pour désigner les administrateurs. Utilisez une valeur aléatoire forte pour le secret, par exemple :

```bash
openssl rand -base64 48
```

## Base de données

Pour une base de développement locale, appliquez les migrations avant le premier démarrage; la production Netlify utilise le runner `db:migrate:production` après le préflight :

```bash
pnpm db:migrate
```

La migration `0010_local_authentication.sql` conserve l’identifiant historique `openId` comme colonne nullable, ajoute `authId` et `passwordHash` sans effacer les lignes utilisateurs, puis impose l’unicité des emails après le préflight production.

Les migrations `0011_messages.sql`, `0012_project_snapshots.sql`, `0013_image_attachments.sql`, `0014_ai_usage.sql` et `0015_attachment_payloads.sql` ajoutent l’historique de chat, les snapshots, les métadonnées d’images, le suivi de coût IA et les octets d’image persistés dans Aiven.

> Les comptes issus d’une ancienne installation ne disposent pas de mot de passe local. Ils sont conservés dans la base, mais nécessitent une procédure de réinitialisation vérifiée avant de se connecter avec le nouveau formulaire local.

## Vérification

```bash
pnpm check
pnpm test
pnpm build
APP_SESSION_SECRET="$(openssl rand -base64 48)" pnpm start
```

Le point de santé `/api/health` indique les prérequis actifs. Avec `?deep=1`, il vérifie également la connectivité à la base de données.

## Fichiers et pièces jointes

Les nouvelles images de chat sont stockées dans la colonne `attachments.fileData` (`MEDIUMBLOB`) d’Aiven; le répertoire privé `FILE_STORAGE_DIR` (par défaut `var/uploads`) n’est conservé qu’en lecture de compatibilité pour d’anciens fichiers locaux. Les images ne sont jamais exposées par une URL publique anonyme. PNG, JPEG, WebP et GIF sont acceptés, jusqu’à **4 Mio** par image afin de rester sous la limite de requête des Netlify Functions. L’analyse multimodale est activée pour OpenAI, Anthropic, Gemini et OpenRouter (avec un modèle vision).

Les générations et les téléchargements privés lisent d’abord le BLOB Aiven. Les anciens enregistrements reposant sur le disque local restent lisibles seulement si leur fichier de compatibilité existe encore.
