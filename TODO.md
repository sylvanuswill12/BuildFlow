# BuildFlow AI — objectifs du projet

## Parcours de création et génération
L’application est une application Web de création de logiciels assistée par IA, comparable à bolt.new. L’utilisateur décrit une application en langage naturel; BuildFlow crée et modifie progressivement les fichiers du projet, affiche le flux d’actions et actualise l’aperçu sans imposer une régénération complète.

## Exécution et réparation autonome
Les projets générés utilisent le contrat partagé Vite/React 19 déjà retenu. BuildFlow exécute le code dans WebContainers avec aperçu en temps réel et HMR, conserve le préchauffage, les snapshots binaires de dépendances et la synchronisation différentielle, et tente automatiquement de diagnostiquer puis réparer les erreurs d’exécution ou de compilation.

## Espace de travail, historique et pièces jointes
L’espace de travail réunit projets, conversations, navigation de fichiers, édition de code, aperçu et historique. Les messages sont conservés côté serveur avec une fenêtre contextuelle glissante; les snapshots permettent de retrouver les états du projet. Les utilisateurs peuvent joindre des images PNG, JPEG, WebP ou GIF de 4 Mio maximum; les octets sont persistés en `MEDIUMBLOB` dans Aiven et restent privés, avec contrôle de propriétaire lors du téléchargement.

## Authentification, comptes et crédits
L’application conserve l’authentification locale par e-mail et mot de passe, le hachage scrypt et les sessions JWT; elle garde les comptes, projets, messages, snapshots et pièces jointes persistants, ainsi que les crédits utilisateur. Elle ne s’appuie ni sur l’authentification ni sur la base de données Manus.

## Fournisseurs IA, routage et coût
Les adaptateurs natifs OpenAI, Anthropic et Gemini restent pris en charge. Le routage choisit un modèle léger ou puissant selon la complexité; un échec ou dépassement de délai peut déclencher un fallback automatique sans rejouer un flux d’actions déjà émis. Chaque génération conserve ses comptes de tokens, son fournisseur/modèle, son éventuel fallback, sa latence et une estimation de coût. La sélection de contexte exploite l’index local des imports pour inclure les modules liés.

## Réglages et transparence des performances
Chaque nouvelle capacité expérimentale est contrôlable dans les paramètres. Le document `docs/performance.md` décrit les changements activables, les mesures réellement observées et les limites; aucune mesure non effectuée n’est présentée comme un résultat.

## Stripe, base externe et déploiement
Les fonctions existantes de crédits, Stripe et choix de déploiement vers Vercel, Netlify ou Cloudflare Pages sont conservées. MySQL est hébergé sur Aiven; la connexion reste côté serveur via la variable déjà configurée sur Netlify et n’est jamais exposée au navigateur. Les migrations Drizzle s’exécutent uniquement dans le contexte de production après un préflight empêchant la migration si plusieurs comptes partagent une adresse e-mail; les Deploy Previews et Branch Deploys ne modifient pas Aiven. Le dépôt source est `sylvanuswill12/BuildFlow`, branche `main`; son site Netlify existant est `buildflowia` et la production doit se déployer automatiquement depuis la branche configurée. Aucun nouveau dépôt GitHub ni site Netlify n’est créé.

## Indépendance et confidentialité
Le runtime livré est indépendant de l’infrastructure et des services Manus. Les clés de fournisseurs IA, les secrets Stripe, les sessions et la connexion Aiven restent côté serveur; aucun secret n’est inclus dans les bundles client, les journaux, les captures, les exemples versionnés ou les commits. L’application demeure une application Web responsive, et non un binaire Expo natif.
