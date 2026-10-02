# Architecture BuildFlow AI

## Décision de migration

BuildFlow est actuellement une application Vite + React + Express/tRPC fonctionnelle. Une migration big-bang vers Next.js casserait la preview WebContainer et les routes existantes. La migration se fait donc par étapes :

1. **Design system et état UI** : tokens CSS, Zustand, Motion, composants réutilisables.
2. **Contrats backend** : séparation des services, schéma métier et patches multi-fichiers.
3. **Next.js App Router** : migration de la landing page et des pages publiques vers SSR/SSG.
4. **Supabase** : authentification, PostgreSQL, stockage et realtime pour les projets générés.
5. **Déploiement** : frontend statique/Next compatible Cloudflare Pages, APIs séparées selon les besoins.

## Stack adoptée

- React + TypeScript + Tailwind CSS v4
- Radix primitives compatibles shadcn/ui, avec tokens BuildFlow personnalisés
- Zustand pour l’état UI du workspace
- Motion pour les animations React et les transitions respectueuses de `prefers-reduced-motion`
- GSAP réservé à la landing page et au storytelling au scroll
- Rive prévu pour les avatars interactifs des agents lorsqu’un asset `.riv` est fourni
- Recharts pour les graphiques métier
- Supabase optionnel via `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
- Sentry optionnel via `VITE_SENTRY_DSN`
- Playwright pour les parcours critiques

## Déploiement recommandé

Le workspace authentifié et le runtime de génération restent dynamiques. Les pages publiques peuvent être exportées statiquement. Les routes API privées doivent conserver leur contrôle d’accès et ne doivent jamais être servies par un fallback SPA. Cloudflare Pages est la cible de publication du frontend ; Supabase porte les données et l’authentification ; un worker/API séparé porte les opérations serveur qui ne peuvent pas être statiques.

## Variables d’environnement

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SENTRY_DSN=
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
```

Les secrets serveur ne doivent jamais être préfixés par `VITE_`.
