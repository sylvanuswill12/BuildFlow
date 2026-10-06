# BuildFlow AI — correction runtime et génération

Cette version corrige le runtime WebContainer sur Netlify avec `client/public/_headers`, un contrôle d’isolation cross-origin, un délai de boot adapté, une installation npm plus fiable, le montage correct des composants générés et une iframe preview compatible.

La génération utilise OpenAI par défaut lorsque les variables Netlify le permettent, avec repli serveur vers un provider configuré. Le contrat IA exige désormais un JSON strict contenant les fichiers complets et vérifiables, jusqu’à 12 fichiers par génération.

Validation effectuée : `pnpm check`, `pnpm test` (21 tests), `pnpm build` et vérification de `dist/public/_headers`.
