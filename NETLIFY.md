# Déploiement BuildFlow sur Netlify

Cette version est préparée pour une architecture Vite + Netlify Functions + Express. Le frontend est publié dans `dist/public`; les routes backend sont servies par `netlify/functions/api.ts` et `/api/*` est redirigé vers cette Function.

## Configuration Netlify obligatoire

Dans **Project configuration → Environment variables**, ajoutez les valeurs réelles dans le scope **Production**. Ne mettez jamais ces valeurs dans GitHub, le ZIP ou un fichier `.env` commité.

| Groupe | Variables | Utilité |
|---|---|---|
| Session et login | `MANUS_PROJECT_ID`, `MANUS_JWT_SECRET`, `MANUS_OAUTH_API_URL`, `MANUS_OAUTH_PORTAL_URL` | Connexion, cookies et sessions signées |
| Base | `DATABASE_URL` | Utilisateurs, projets, crédits et déploiements persistants |
| IA | Au moins un provider complet, par exemple `OPENAI_API_KEY`, ou `MANUS_API_URL` + `MANUS_API_KEY`, ou `GOOGLE_GENERATIVE_AI_API_KEY` | Génération initiale et modifications IA |
| Facturation facultative | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Paiements et webhooks Stripe |
| Publication depuis BuildFlow facultative | `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` | Bouton de publication vers Netlify |

Le modèle complet est dans `.env.example`. Les variables `VITE_*` sont publiques et doivent être définies avant le build si la fonction frontend concernée est utilisée.

## Build Netlify

Le fichier `netlify.toml` définit automatiquement :

```text
Build command: pnpm build
Publish directory: dist/public
Functions directory: netlify/functions
```

Aucun plugin Next.js ne doit être installé : BuildFlow utilise Vite, pas Next.js.

## Vérification après chaque publication

1. Ouvrez `https://VOTRE_SITE.netlify.app/` et vérifiez que l’interface se charge.
2. Ouvrez `https://VOTRE_SITE.netlify.app/api/health`. Cette route doit répondre en HTTP 200 et retourner `status: "ok"`.
3. Ouvrez `https://VOTRE_SITE.netlify.app/api/health?deep=1`. Le champ `checks.database` doit être `true` lorsque `DATABASE_URL` est valide et accessible.
4. Le champ `ready` doit être `true` pour considérer l’environnement complet : API, base, session, OAuth et au moins un provider IA sont alors configurés.
5. Si `ready` est `false`, l’API répond toujours avec les noms des contrôles manquants sans révéler les secrets. Corrigez uniquement les variables indiquées dans Netlify puis utilisez **Clear cache and deploy site**.

## Base de données

Après avoir créé la base MySQL compatible, exécutez les migrations depuis un environnement qui possède `DATABASE_URL` :

```bash
pnpm db:migrate
```

La migration `drizzle/0009_real_deployments.sql` ajoute les métadonnées de publication aux projets.

## Limites Netlify à connaître

Les Functions ont des limites de durée et de mémoire. Les opérations IA longues et le SSE peuvent être limités par le plan Netlify. Si les générations longues sont interrompues malgré une configuration correcte, le backend doit être déplacé vers un runtime Node persistant (Render, Railway, Fly.io ou VPS), tout en conservant le frontend Netlify.
