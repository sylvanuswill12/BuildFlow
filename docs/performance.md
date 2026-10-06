# Mesures de performance BuildFlow

> Les mesures sont relevées dans le sandbox de développement avec `pnpm build`, Vitest et Playwright. Elles ne représentent pas les performances d’un navigateur utilisateur ou d’un WebContainer hébergé. La page `/api/health` et les tests e2e de cette session n’exécutent pas un projet utilisateur dans WebContainer; aucun temps de preview inférieur à 5 s n’est donc revendiqué.

## Phase 4 — Vitesse

### Avant

- `WebContainer.boot()` avait un timeout maximal de **45 000 ms**. Il s’agit d’une limite d’échec, pas d’une mesure de démarrage médiane.
- Chaque nouveau contexte navigateur montait les fichiers puis exécutait `npm install`; aucun snapshot binaire des dépendances n’était conservé entre les rechargements.
- L’installation était déjà réutilisée en mémoire dans un onglet lorsque le `package.json` était identique; l’empreinte ne tenait toutefois compte que de ce fichier.
- La clé de l’iframe de preview comprenait la révision, ce qui pouvait la démonter/remonter après une génération au lieu de laisser Vite appliquer HMR.
- L’ouverture de `/new` ne préchauffait pas WebContainer.

### Après

- Un snapshot binaire de `node_modules` est indexé dans IndexedDB selon une empreinte SHA-256 de `package.json`, des fichiers lock et `.npmrc`; limite de **80 Mio par snapshot**, **5 entrées** et **30 jours**. Les erreurs/quota du navigateur n’empêchent pas l’installation npm normale.
- Le runtime journalise `WebContainer préchauffé en … ms` et `Runtime prêt en … ms`; `/new` lance le préchauffage dès son ouverture si l’option est activée.
- Les mises à jour de fichiers restent différentielles; la clé de l’iframe n’inclut plus la révision, laissant le HMR actif. Les actions `<file>`/`<patch>` sont déjà appliquées à mesure qu’elles arrivent.
- Paramètres > Fonctionnalités expérimentales permet de désactiver le préchauffage et le cache.

### Mesures disponibles

| Mesure | Avant | Après | Interprétation |
|---|---:|---:|---|
| `pnpm build` (temps Vite rapporté) | 6,47 s | 6,22 s | −0,25 s (~3,9 %), bruit de mesure probable; compilation serveur ~0,01 s dans les deux cas. |
| Chunk JS principal minifié | 750,10 kB | 756,42 kB | +6,32 kB, dû au cache et à l’interface de réglages; l’optimisation runtime n’a pas réduit le bundle. |
| Tests unitaires après les nouvelles fonctions | 59 tests / 18 fichiers | 63 tests / 20 fichiers | 4 tests ajoutés pour les clés/quota et les préférences. |
| Preview d’un nouveau projet | Non mesurée | Non mesurée | L’acceptation « médiane <5 s sur 5 essais » reste à vérifier dans un navigateur avec WebContainer réellement opérationnel. |

Le premier install npm reste le chemin froid de repli et peut dépasser 5 s. IndexedDB ne garantit pas la conservation si le navigateur purge les données; le test de médiane réelle demeure une étape de déploiement.

## Prochaines mesures

Pour mesurer l’objectif de preview, exécuter cinq fois le même template avec une base WebContainer vierge, puis cinq fois avec le snapshot IndexedDB, relever le temps entre soumission et événement `server-ready`, et comparer les médianes. Noter navigateur/version, système, cache froid/chaud, taille du snapshot et statut COOP/COEP. Ne pas agréger ces chiffres aux durées de `pnpm build` ou de la suite Playwright.

## Phase 5 — Intelligence & coût

### Comportement livré

- Le classifier calcule une complexité `low`, `medium` ou `high` depuis la longueur de la demande, la quantité/taille des fichiers, et des signaux de refactorisation, sécurité, architecture, debug ou petite retouche. Si le routage intelligent est actif et qu’aucun modèle n’a été imposé, le serveur choisit un modèle du tier associé chez le provider demandé. Un modèle explicite reste respecté.
- Le fallback automatique considère le provider primaire puis au plus **deux alternatives configurées** (ordre facultatif via `AI_FALLBACK_PROVIDERS`). Chaque tentative est limitée à **60 s**. En streaming, il ne bascule que si aucune donnée n’a encore été envoyée; ainsi une action partielle n’est pas rejouée. Les providers sans vision sont exclus des alternatives si la requête comprend une image.
- L’index d’imports est reconstruit côté serveur à partir des fichiers du projet; il suit jusqu’à trois niveaux d’imports relatifs/alias dans la sélection, tout en conservant la limite préexistante de **10 fichiers / 48 Ko**. La désactivation revient à la sélection directe.
- `ai_usage` trace provider, modèle effectivement employé, complexité, tokens entrée/sortie, coût indicatif en micro-USD, latence et éventuel provider primaire en échec. Utilisation : tokens fournisseurs quand retournés; sinon estimation à **1 token / 4 caractères** et **768 tokens / image**. La table de tarifs embarquée contient des valeurs de référence et des replis; les coûts sont **des estimations, non une facturation ni un relevé fournisseur**. Un résumé des 100 derniers enregistrements est affiché dans Paramètres.
- Tous les nouveaux mécanismes sont réglables dans **Paramètres → Fonctionnalités expérimentales** : templates de démarrage, routage intelligent, fallback, suivi des coûts et index d’imports. Valeurs initiales : activé pour templates/fallback/suivi/index; désactivé pour routage intelligent.
- Les migrations additives `0010` à `0015` sont indexées dans le journal; le runner Netlify applique le journal uniquement en contexte `production`, après préflight, sans migration Aiven exécutée depuis le Sandbox.

### Mesures validées dans le sandbox

| Vérification | Résultat observé | Interprétation |
|---|---:|---|
| `pnpm check` | Réussi | Aucun diagnostic TypeScript. |
| `pnpm test` | **73 tests / 23 fichiers** | Routage/fallback, estimation, import graph, starters, taille d’upload et cookies HTTPS compris; providers simulés. |
| `pnpm build` | Vite **6,33 s**; serveur esbuild **18 ms** | Build production réussi après l’ajout du stockage BLOB. |
| Chunk JavaScript principal minifié | **766,51 kB** (**224,00 kB gzip**) | Avertissement Vite persistant au seuil de 500 kB; Phase 7 doit poursuivre le découpage. |
| `pnpm test:e2e` | **3 tests passés / 3,2 s** | Smoke landing, navigation templates et affichage mobile sans débordement horizontal à 390 px. |
| Route manifest Preview | **12 routes, HTTP 200** local et public | JSON statique conforme aux routes Wouter inspectées. |
| Migrations, `CONTEXT=deploy-preview` | Sautées explicitement | Le préflight/migrateur de production n’a pas touché Aiven depuis le Sandbox. |
| Temps de fallback réel, réussite provider, coût API réel | Non mesurés | L’intégration a été vérifiée par réponses simulées; une validation de bout en bout nécessite des clés/provid­ers configurés et budget externe. |
| Preview template `server-ready` médiane | Non mesurée | Le démarrage est sans appel IA; boot/npm WebContainer et l’objectif médian <5 s nécessitent toujours cinq essais navigateur froids et chauds. |

La durée du build, le gzip du bundle et la durée Playwright ne sont pas des substituts aux latences providers ou au temps `server-ready`. Aucune performance médiane de preview ni économie de coût IA n’est revendiquée sans mesure directe.


## Robustesse des uploads Netlify/Aiven — 4 octobre 2026

- Les images sont limitées à **4 Mio** (4 194 304 octets). En JSON base64, cela représente au plus **5 592 408 caractères** avant l’enveloppe JSON, avec une marge sous la limite de requête tamponnée documentée de 6 Mo pour les Netlify Functions ([documentation officielle](https://docs.netlify.com/build/functions/configuration/)). Client, API et validation du contenu utilisent la même constante partagée.
- Les nouvelles pièces jointes sont écrites dans `attachments.fileData` (`MEDIUMBLOB`) sur MySQL/Aiven; les téléchargements gardent le contrôle de session et de propriétaire. Le disque local n’est plus la source primaire de données en production; il reste en lecture de compatibilité pour d’anciens fichiers locaux.
- La migration `0015_attachment_payloads` ajoute une colonne nullable; elle ne réécrit pas les anciennes lignes. La transition locale `0010` garde également la colonne `openId` historique, ajoute un `authId` nullable et conserve les lignes utilisateurs pour une compatibilité de rollback.
- En contexte Netlify autre que `production`, `db:migrate:production` saute la migration. En production, le préflight détecte les groupes d’e-mails dupliqués et arrête le build avant tout DDL; sinon Drizzle applique le journal existant et les migrations additives.
- Limite opérationnelle observée : le préflight/migrateur n’a pas encore été exécuté sur Aiven depuis le Sandbox, car sa valeur de connexion n’est pas disponible ici. Le déploiement Netlify de production sera bloqué si la variable `DATABASE_URL` n’est pas disponible au build ou si le préflight échoue; aucune valeur secrète n’est lue ni journalisée.


## Actualisation du 6 octobre 2026 — OmniRoute et découpage

- `pnpm check` : réussi; diagnostics TypeScript sans erreur.
- `pnpm test` : **77 tests / 23 fichiers** réussis, avec réponses provider simulées.
- `pnpm test:e2e` : **3/3** tests smoke réussis en **3,3 s** (landing, templates, affichage mobile).
- `pnpm build` : Vite **6,27 s**, serveur esbuild **12 ms**; build production réussi.
- Chunk partagé principal : **545,57 kB** minifié (**171,06 kB gzip**); page Workspace : **83,85 kB** (**21,52 kB gzip**); runtime WebContainer : **23,26 kB** (**9,43 kB gzip**). Le chunk principal dépasse encore le seuil Vite de 500 kB non compressés. Par rapport au relevé antérieur à **766,51 kB / 224,00 kB gzip**, la taille mesurée est inférieure d’environ **28,82 % / 23,63 %** respectivement; ce sont des tailles de build, pas une mesure de temps réseau utilisateur.
- Le manifeste de Preview répond en JSON sur 12 routes. Les tests n’exécutent pas une génération réelle dans un WebContainer et le provider OmniRoute est validé avec mocks; aucune latence live, aucun coût réel et aucune médiane de démarrage WebContainer ne sont revendiqués.
- OmniRoute accepte le modèle `auto`, s’intègre au provider par défaut/fallback et garde l’URL et la clé dans l’environnement serveur; son gateway doit être hébergé séparément et accessible à Netlify en HTTPS.
