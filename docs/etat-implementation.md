# État d’implémentation BuildFlow

## Livré dans cette version

- Le formulaire `/new` lance maintenant une génération IA initiale côté serveur.
- La génération crée le projet, consomme un seul crédit, persiste les fichiers générés et ouvre le workspace.
- En cas d’échec du provider, le brouillon est conservé afin de permettre une nouvelle tentative depuis le workspace.
- La génération affiche une progression utilisateur : analyse, architecture, génération, sauvegarde et preview.
- La progression de `/new` est alimentée par un flux SSE serveur (`/api/generation/stream`) et se ferme proprement à la fin ou en cas d’abandon.
- Le chat du workspace utilise désormais `/api/generation/change-stream` pour recevoir les fragments token par token des providers compatibles, avec fallback complet pour BuildFlow AI.
- Le résultat final du flux est validé par le schéma de génération avant application ; une session absente reçoit HTTP 401 sans faire tomber le serveur.
- L’écran `Paramètres` liste les providers IA configurés et permet de tester chaque connexion.
- Les tests de provider affichent le résultat, la latence et le message d’erreur sans exposer les clés secrètes.
- L’écran `Paramètres` propose également un test de connectivité Supabase via `auth.getSession()` lorsque les variables publiques sont présentes.
- L’écran `Paramètres` affiche un pré-contrôle Vercel, Netlify et Cloudflare Pages sans exposer les secrets et sans déclarer un projet publié à tort.
- Le bouton `Publier` utilise maintenant la mutation serveur de déploiement : Netlify par ZIP, Vercel par upload SHA + création REST, et Cloudflare Pages via Wrangler pour le bundle pré-buildé.
- Le projet n’est marqué `Publié` qu’après confirmation `ready` du fournisseur ; les erreurs et l’URL du dernier déploiement sont persistées.
- La cible Netlify sépare maintenant l’entrée Express locale de l’entrée Netlify Function, utilise la redirection officielle `/.netlify/functions/api/:splat` et expose `/api/health?deep=1` pour diagnostiquer API, base, session, OAuth et provider IA sans révéler les secrets.
- Le serveur conserve la route de santé publique `/api/health`.

## Vérifications effectuées

- `pnpm check` : réussi.
- `pnpm test` : 18 tests réussis.
- `pnpm build` : réussi.
- `pnpm test:e2e` : 2 scénarios publics réussis après installation du navigateur Chromium Playwright.
- `/api/health` : HTTP 200 vérifié sur le serveur de production.
- `/api/generation/stream` : événements SSE de progression vérifiés.
- `/api/generation/change-stream` : réponse 401 sans session et maintien de `/api/health` vérifiés.
- Garde-fous déploiement : 2 tests unitaires dédiés, dont le refus d’un projet source-only sans `index.html`.
- Runtime Netlify : handler testé directement avec HTTP 200 sur `/api/health`, bundle Function contrôlé sans Vite/Tailwind/LightningCSS, serveur production local et `/api/generation/change-stream` 401 sans session vérifiés.

## Configuration nécessaire en production

- `MANUS_API_URL` et `MANUS_API_KEY`, ou un provider externe configuré, pour une génération réelle.
- `GOOGLE_GENERATIVE_AI_API_KEY` pour Gemini.
- `OPENAI_API_KEY` pour OpenAI.
- `DATABASE_URL` pour conserver les projets et les crédits entre redémarrages.
- Les variables OAuth et Stripe pour les parcours correspondants.

## Prochaines intégrations à réaliser

La publication réelle nécessite les secrets des fournisseurs et un bundle statique pré-buildé contenant `index.html`. Cloudflare nécessite en plus Wrangler installé dans le runtime ou déclaré via `CLOUDFLARE_WRANGLER_BIN`. La synchronisation complète Supabase nécessite encore ses contrats et secrets de production.
