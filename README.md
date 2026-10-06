# BuildFlow AI — installation autonome

BuildFlow est une application **React + Express + tRPC + Drizzle** qui ne dépend d’aucun service de plateforme propriétaire. Les comptes utilisent une adresse email, un mot de passe haché avec scrypt et une session JWT signée localement.

## Démarrage

```bash
cp .env.example .env
# renseigner APP_SESSION_SECRET, DATABASE_URL et au moins un fournisseur IA
pnpm install
pnpm db:migrate
pnpm dev
```

- `pnpm dev` : serveur de développement sur `PORT` (3000 par défaut).
- `pnpm build` puis `pnpm start` : build et serveur de production.
- `pnpm db:migrate` : applique le journal SQL MySQL versionné; `pnpm db:push` est un alias d’application sans génération automatique de DDL.
- `pnpm check` et `pnpm test` : vérifications de types et tests unitaires.

## Configuration minimale

| Variable | Rôle |
|---|---|
| `APP_SESSION_SECRET` | Secret d’au moins 32 caractères qui signe les sessions locales. |
| `DATABASE_URL` | Base MySQL compatible pour comptes, projets et crédits. |
| `OPENAI_API_KEY` ou autre provider IA | Génération de projet et modifications IA. |

`ADMIN_EMAILS` est facultatif ; il contient les adresses email administratrices séparées par des virgules. Les services Stripe, Supabase, Sentry, Maps, Vercel, Netlify et Cloudflare restent facultatifs et se configurent directement avec leurs propres variables.

## Migration depuis une version antérieure

La migration `0010_local_authentication.sql` conserve l’identifiant historique `openId` en lecture de compatibilité, ajoute les champs d’authentification locale sans supprimer les lignes utilisateurs et impose l’unicité des emails après préflight. Les anciens comptes sans hash de mot de passe sont conservés mais nécessitent une procédure de réinitialisation vérifiée avant d’utiliser la connexion locale.

Les nouvelles pièces jointes d’image (PNG, JPEG, WebP ou GIF; 4 Mio maximum) sont conservées dans un `MEDIUMBLOB` MySQL/Aiven. En production, le build Netlify applique les migrations uniquement en contexte `production`; les Deploy Previews ne modifient pas la base.
