# Architecture visuelle BuildFlow AI

## Primitives partagées

Les composants `client/src/components/buildflow/motion.tsx` constituent la couche de présentation commune :

- `AnimatedReveal` : entrée progressive des sections avec easing court ;
- `AnimatedMetric` : apparition douce des métriques sans compteur artificiel ;
- `GlassPanel` : surface premium unique pour les cartes et panneaux ;
- `AmbientBackground` : profondeur lumineuse légère, désactivée en reduced-motion.

Les primitives portent les règles d’animation afin d’éviter que chaque écran implémente son propre timing ou sa propre gestion de l’accessibilité.

## Règles d’animation

- Motion est utilisé pour les animations d’interface React : entrées, interactions, layout et feedback tactile.
- Les animations restent courtes, avec des déplacements faibles et des transitions naturelles.
- `useReducedMotion` désactive les déplacements et les boucles ambient lorsque l’utilisateur le demande.
- Les effets de profondeur sont rendus par des surfaces et bordures sobres plutôt que par des blur excessifs.
- Le futur storytelling de la landing page pourra utiliser GSAP/ScrollTrigger sans contaminer le workspace applicatif.

## Direction artistique

- fond bleu nuit avec halos électriques bleu/violet ;
- surfaces glassmorphism lisibles ;
- bordures fines et états focus visibles ;
- couleurs sémantiques pour opportunités, risques, succès et erreurs ;
- responsive mobile sans animation lourde obligatoire.

## Prochaine étape d’architecture

Extraire progressivement les écrans du monolithe `App.tsx` vers des modules par fonctionnalité (`features/dashboard`, `features/research`, `features/workspace`) en conservant ces primitives comme contrat visuel partagé.
