# Déploiement BuildFlow sur Netlify

Cette version est autonome : le frontend Vite est publié dans `dist/public` et les routes Express/tRPC sont servies par `netlify/functions/api.ts`.

## Variables Netlify

Ajoutez les valeurs suivantes dans **Project configuration → Environment variables** ; ne les mettez jamais dans Git ou dans l’archive :

| Groupe                  | Variables                                                                                                            | Utilité                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session locale          | `APP_SESSION_SECRET`, `ADMIN_EMAILS` (facultatif)                                                                    | Cookies et rôles locaux.                                                                                                                                              |
| Base                    | `DATABASE_URL`                                                                                                       | Comptes, projets, crédits et déploiements persistants.                                                                                                                |
| IA                      | Une clé de provider, par exemple `OPENAI_API_KEY`; ou `OMNIROUTE_API_BASE_URL` et `OMNIROUTE_API_KEY` pour OmniRoute | Génération et modifications IA. L’URL OmniRoute doit être accessible en HTTPS depuis les Functions et se terminer par `/v1`; les deux variables restent côté serveur. |
| Facturation facultative | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                                                                         | Paiements et webhooks Stripe.                                                                                                                                         |
| Publication facultative | `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`                                                                              | Publication vers Netlify depuis BuildFlow.                                                                                                                            |

Le normaliseur traduit le `ssl-mode` Aiven en options TLS `mysql2` côté serveur. Selon la
[documentation Aiven](https://aiven.io/docs/platform/concepts/tls-ssl-certificates),
`ssl-mode=REQUIRED` chiffre la connexion mais ne vérifie pas le certificat du serveur; c’est le
mode de l’URI Aiven utilisée actuellement. Pour vérifier aussi l’identité du serveur, utilisez
`ssl-mode=VERIFY_IDENTITY` avec l’option `ssl` JSON de `mysql2` contenant le certificat CA Aiven;
les modes `VERIFY_CA` et `VERIFY_IDENTITY` refusent de démarrer sans ce CA.

`APP_SESSION_SECRET` doit faire au moins 32 caractères ; générez-le par exemple avec `openssl rand -base64 48`.

## Build et vérification

`netlify.toml` configure automatiquement :

```text
Build command: pnpm build && pnpm db:migrate:production
Publish directory: dist/public
Functions directory: netlify/functions
```

`db:migrate:production` n’exécute le migrateur Drizzle que lorsque le contexte Netlify intégré
`CONTEXT` vaut `production`; les Deploy Previews et Branch Deploys ne touchent pas à Aiven.
Avant toute migration, un préflight vérifie la table `users` et bloque les groupes de courriels
en double sans afficher d’adresse ni commencer de changement de schéma. La migration locale
`0010` conserve l’identifiant historique `openId` pour une compatibilité de rollback; le
runtime BuildFlow n’utilise que l’authentification locale. Les anciens comptes sans
`passwordHash` restent conservés mais ne peuvent pas ouvrir une session par mot de passe; une
procédure de réinitialisation vérifiée, non fournie par ce build, est nécessaire.

Après publication, vérifiez `https://VOTRE_SITE.netlify.app/api/health`. Avec `?deep=1`, le contrôle base de données effectue une requête réelle. `ready: true` indique que l’API, la base, les sessions locales et au moins un provider IA sont configurés.

## Base de données

Pour une base de développement locale (la production Netlify applique automatiquement le
journal après son préflight) :

```bash
pnpm db:migrate
```

Les Functions Netlify ont des limites de durée. Pour des générations IA longues ou du SSE intensif, préférez un runtime Node persistant (Render, Railway, Fly.io ou VPS).

## Pièces jointes privées

Les images envoyées en JSON base64 sont limitées à **4 Mio** afin que l’encodage et l’enveloppe
JSON restent sous la limite de requête tamponnée documentée par [Netlify Functions](https://docs.netlify.com/build/functions/configuration/).
Les nouveaux octets sont conservés dans `attachments.fileData` (`MEDIUMBLOB`) chez Aiven; le
stockage `FILE_STORAGE_DIR` ne sert qu’à relire les anciens enregistrements locaux. Le chemin
HTTP `/api/attachments/:id` continue de vérifier la session et le propriétaire avant de renvoyer
les octets privés.
