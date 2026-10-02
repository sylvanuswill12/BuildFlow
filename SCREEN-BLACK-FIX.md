# Correction de l’écran noir

La version précédente utilisait un découpage manuel Vite des dépendances React. Sur Netlify, le chunk React résultant échouait au chargement avec l’erreur `Cannot set properties of undefined (setting 'Activity')`, avant le rendu de `#root`.

La configuration `vite.config.ts` a été corrigée pour laisser Vite gérer le graphe des dépendances sans `manualChunks`. Le build a été vérifié avec :

```bash
pnpm check
pnpm test
pnpm build
```

Résultat : 21 tests réussis et la landing page rendue correctement dans le navigateur.

## Import GitHub

Remplacez le contenu du dépôt GitHub par le contenu de cette archive, en conservant le fichier `.env` uniquement dans Netlify et jamais dans GitHub. Netlify déclenchera ensuite automatiquement un nouveau déploiement.

Après le déploiement, vérifiez :

- `https://votre-site.netlify.app/`
- `https://votre-site.netlify.app/api/health?deep=1`
