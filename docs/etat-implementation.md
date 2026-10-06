# État d’implémentation BuildFlow AI

## Phase 0 — Nettoyage (terminée)

`App.tsx` est passé d’environ 215 Ko à 28 Ko. Les pages sont isolées dans `client/src/pages/`, le panneau partagé dans `client/src/components/Panel.tsx` et les panneaux du workspace dans `client/src/workspace/{chat,preview,files,bottom}/`. Le contrat de génération est centralisé dans `server/ai/generationContract.ts` : le prompt et le schéma ciblent React + TypeScript + Vite, avec `src/App.tsx` comme entrée. Le starter ne force plus l’exemple Expense.

Le runtime est générique : les chemins générés sont conservés, les fichiers Vite/TypeScript/HTML/Tailwind manquants sont ajoutés, les chemins hors racine sont refusés et les fichiers modifiés sont synchronisés individuellement. La preview simulée a été supprimée au profit du vrai runtime WebContainer démarré automatiquement.

## Phase 1 — Fondations agent (terminée)

- **Historique persistant** : table SQL/Drizzle `messages` (`projectId`, rôle, contenu, actions, date, propriétaire), migration `0011_messages.sql`, endpoints protégés par propriété du projet; rechargement des messages à l’ouverture et sauvegarde des demandes/réponses. Le serveur récupère lui-même le contexte, le réduit à une fenêtre glissante et résume les anciens tours avant l’appel IA.
- **Runtime générique** : les fichiers du projet sont montés sans chemins Expense codés en dur; modèles Vite, TS, HTML, CSS Tailwind et package sont créés au besoin.
- **Logs réels** : sorties npm/Vite du WebContainer alimentent Logs et Terminal; le pont iframe transmet `window.onerror`, les rejets de promesses non gérés et `console.error` vers l’onglet Erreurs, avec compteur réel. Le flux fourni par WebContainer est capturé comme une sortie combinée; la distinction stdout/stderr est une classification d’affichage par motif, pas un canal séparé fourni par l’API.
- **Dépendances** : la signature de `package.json` invalide l’état d’installation et déclenche `npm install` lors d’un changement; la sortie de l’installation est journalisée. L’écriture des fichiers reste différentielle (`fs.writeFile`/suppression).

Validation de phase : `pnpm check` réussi, `pnpm test` réussi (**25 tests**, 8 fichiers), `pnpm build` réussi, `pnpm test:e2e` réussi (**2 tests**). Le build conserve un avertissement de taille de bundle frontend (>500 Ko minifié). La migration SQL est incluse mais n’a pas été appliquée à une base de production dans cet environnement.

## Phase 2 — Boucle agent (terminée)

- **Actions en flux** : `<file>`, `<patch>`, `<shell>`, `<delete>` et `<message>` sont parsées de façon incrémentale et appliquées pendant la génération; le chemin JSON reste pris en charge pour les fournisseurs legacy. Les commandes exécutées renvoient code de sortie et sortie au modèle.
- **Auto-réparation** : après un changement en mode Build, `npm run build` est lancé dans WebContainer. Les erreurs runtime/commandes et les diagnostics sont transmis au modèle avec un jeton de réparation serveur limité à trois tentatives. La génération initiale seule consomme un crédit; l’étape et les erreurs persistent dans le chat.
- **Modes et prompt** : Plan et Discussion n’appliquent pas de fichiers ni de commandes. L’outil « Améliorer » reformule le prompt avec le provider sélectionné et indique la consommation d’un crédit.
- **Contexte ciblé** : l’arborescence complète est envoyée, mais le contenu est limité aux fichiers actifs, imports directs, noms mentionnés dans les diagnostics et meilleurs candidats du prompt (maximum 10 fichiers / 48 Ko).
- **Anthropic** : adaptateur natif `/v1/messages`, en-têtes officiels et SSE `content_block_delta`/`text_delta`; clé uniquement côté serveur. Références officielles : [API Messages](https://platform.claude.com/docs/en/api/messages), [Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [modèles](https://platform.claude.com/docs/en/models/overview).

Validation de phase : `pnpm check` réussi, `pnpm test` réussi (**34 tests**, 10 fichiers), `pnpm build` réussi. Le build signale encore un bundle frontend minifié d’environ 732 Ko (>500 Ko); Phase 3 introduira Monaco en chargement différé et visera à réduire l’impact initial.

## Phase 3 — Éditeur, versions, publication (terminée)

- **Éditeur/arborescence** : Monaco est chargé à la demande; les onglets et dossiers sont dérivés de `projectFiles`, avec création, renommage, suppression et repli des dossiers.
- **Versions/diff** : les snapshots complets sont enregistrés par la migration `0012_project_snapshots.sql`; l’historique compare/restaure tous les fichiers. Après génération, le diff propose l’acceptation ou le rejet fichier par fichier.
- **Publication** : le client lance `npm run build` dans le WebContainer puis exporte récursivement tout `dist/`, binaires compris, en base64. `deploy.publish` valide et décode les artefacts avant l’envoi au provider choisi; l’ancien fallback demeure pour les projets sans build fourni.
- **Images** : téléversement privé, limité à quatre images PNG/JPEG/WebP/GIF de 4 Mio chacune, signature MIME vérifiée, octets persistés dans `attachments.fileData` chez Aiven par la migration additive `0015_attachment_payloads.sql`. `FILE_STORAGE_DIR` reste uniquement en lecture de compatibilité pour d’anciens fichiers locaux. Les aperçus nécessitent une session propriétaire; les appels IA OpenAI, Anthropic, Gemini et OpenRouter reçoivent des blocs image natifs.
- **Export ZIP** : l’archive embarque l’arborescence de fichiers courante au complet, un README et des métadonnées; le manifeste de repli fournit Vite/React/Tailwind. Les chemins de traversée sont ignorés.

Validation finale de la phase : `pnpm check` réussi, `pnpm test` réussi (**59 tests**, 18 fichiers), `pnpm build` réussi et `pnpm test:e2e` réussi (**2 tests**). Avertissement restant : chunk JavaScript minifié de 750 Ko (seuil indicatif Vite de 500 Ko). Les migrations SQL sont livrées mais n’ont pas été appliquées à une base de production dans cet environnement.

## Phase 4 — Vitesse (terminée)

- **WebContainer** : préchauffage à l’ouverture de Nouveau projet, snapshot `node_modules` binaire en IndexedDB, clé SHA-256 dépendances/lockfile/.npmrc, limites de quota et fallback `npm install`. La synchronisation demeure différentielle et le HMR n’est pas démonté par les révisions.
- **Démarrage par template** : quatre arbres de fichiers réels sont fournis (React/Vite/Tailwind, Zustand, dashboard, landing page). « Ouvrir le template sans génération IA » crée le brouillon et ouvre le workspace sans consommer de crédit; l’option reste désactivable dans Paramètres. La génération IA avec template fusionne les fichiers modifiés aux fichiers initiaux.
- Les durées de boot et `server-ready` sont journalisées; l’acceptation de preview médiane <5 s reste **non mesurée** avec un WebContainer navigateur utilisateur. Voir les mesures détaillées dans `docs/performance.md`.

## Phase 5 — Intelligence, coût et robustesse Netlify (implémentée; migrations à appliquer en production)

- **Classifier/routage** : classe les demandes `low` / `medium` / `high` avec heuristiques de complexité et choisit une famille de modèles par provider. Un modèle explicitement choisi par l’utilisateur reste prioritaire; le routage est désactivé par défaut et activable dans Paramètres.
- **Fallback** : jusqu’à deux providers configurés supplémentaires, ordre modifiable par `AI_FALLBACK_PROVIDERS`, timeout de 60 s par appel. En streaming, le fallback n’est tenté qu’avant le premier fragment afin de ne pas rejouer des actions partielles; les images ne sont envoyées qu’aux providers déclarant supporter la vision. L’option est désactivable.
- **Usage/coût** : la table `ai_usage` (migration `0014_ai_usage.sql`) enregistre provider/modèle, complexité, latence, source du fallback, tokens et coût estimé en micro-USD. Les APIs avec statistiques de tokens les fournissent; sinon BuildFlow estime les tokens texte à 1 token/4 caractères et chaque image à 768 tokens. Les tarifs sont des approximations locales et ne constituent pas une facture. Paramètres présente les 100 dernières entrées; le suivi est désactivable.
- **Index d’imports** : graphe local des imports résolus, avec expansion jusqu’à trois niveaux, intégré à la sélection de contexte bornée (10 fichiers / 48 Ko); activable/désactivable.
- **Indépendance** : recherche dans les sources, `package.json` et `pnpm-lock.yaml` sans dépendance ni référence à la plateforme propriétaire.

Validation Phase 5 : `pnpm check` réussi; **73 tests unitaires / 23 fichiers**; `pnpm build` réussi (voir mesures dans `docs/performance.md`); `pnpm test:e2e` réussi (**3 smoke tests**, dont largeur mobile 390 px). Les providers et leur failover sont validés par mocks, pas par des appels facturés en direct. Les migrations `0010` à `0015` sont livrées avec un runner de production et un préflight; elles **n’ont pas été appliquées à Aiven depuis le Sandbox**. Les nouveaux uploads d’images 4 Mio maximum persistent dans un BLOB MySQL. Phase 6 (revue visuelle IA et contrôles dédiés dans le WebContainer) reste à faire.

## Plateforme autonome

L’authentification email/mot de passe, les sessions locales, MySQL/Drizzle, les crédits, Stripe facultatif et les adaptateurs IA standards sont indépendants d’une plateforme propriétaire. Voir `docs/standalone-migration.md` pour le déploiement et la migration de base de données.
