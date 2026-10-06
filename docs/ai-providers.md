# Providers IA BuildFlow

BuildFlow utilise une couche serveur multi-provider. Les clés restent côté serveur et ne sont jamais renvoyées par l’API `ai.providers`.

## Providers disponibles

- `openai` — `OPENAI_API_KEY`
- `anthropic` — `ANTHROPIC_API_KEY` (API native Messages/SSE)
- `google` — `GOOGLE_GENERATIVE_AI_API_KEY`
- `openrouter` — `OPEN_ROUTER_API_KEY`
- `groq` — `GROQ_API_KEY`
- `deepseek` — `DEEPSEEK_API_KEY`
- `mistral` — `MISTRAL_API_KEY`
- `ollama` — `OLLAMA_API_BASE_URL`, sans clé obligatoire
- `openai-compatible` — `OPENAI_LIKE_API_BASE_URL` et `OPENAI_LIKE_API_KEY` facultatif

Les providers distants utilisent OpenAI Chat Completions, sauf Google Gemini (`generateContent`) et Anthropic (`/v1/messages` avec les en-têtes natifs), qui utilisent leurs APIs propres. Modèles Claude disponibles dans le catalogue : Sonnet 5.5, Opus 5.5 et Haiku 4.5. Voir la [documentation Anthropic sur les modèles](https://platform.claude.com/docs/en/models/overview).

## APIs tRPC

- `ai.providers` : catalogue et état de configuration sans secret.
- `ai.models` : modèles proposés pour un provider.
- `ai.testConnection` : appel réel authentifié du provider choisi.
- `projects.generateChange` : génération d’un patch multi-fichiers.

## Exemple

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OLLAMA_API_BASE_URL=http://127.0.0.1:11434/v1
```

Ne préfixez jamais une clé privée par `VITE_`.

## Entrées image (Phase 3)

Les pièces jointes validées (PNG, JPEG, WebP, GIF; **4 Mio maximum par fichier** pour rester sous la limite d’upload tamponnée de Netlify Functions) sont encodées côté serveur pour le provider choisi; les clés API restent côté serveur.

- OpenAI et fournisseurs compatibles : bloc `image_url` contenant une data URL `data:image/...;base64,...` dans le contenu multimodal. Source : [OpenAI Images and vision](https://developers.openai.com/api/docs/guides/images-vision).
- Anthropic : bloc `{ type: "image", source: { type: "base64", media_type, data } }` envoyé à l’API Messages; le guide indique une limite de 10 Mo encodés par image pour l’API Claude directe. Source : [Anthropic Vision](https://platform.claude.com/docs/en/build-with-claude/vision).
- Gemini : bloc `inlineData` avec `mimeType` et `data` (base64) dans les `parts`. Source : [Gemini generateContent](https://ai.google.dev/api/generate-content).

## OmniRoute (gateway déployé séparément)

BuildFlow sait appeler [OmniRoute](https://github.com/diegosouzapw/OmniRoute) à travers son endpoint compatible OpenAI Chat Completions. Le gateway OmniRoute doit être déployé sur un hôte persistant accessible en HTTPS depuis les Netlify Functions; `localhost` désigne la fonction Netlify elle-même, pas le navigateur de l’utilisateur. Son hébergement et ses providers en amont sont séparés de BuildFlow.

Variables côté serveur uniquement :

```env
OMNIROUTE_API_BASE_URL=https://<votre-hote-omniroute>/v1
OMNIROUTE_API_KEY=<cle-api-omniroute>
```

Le modèle sélectionné est `auto`. Lorsqu’OmniRoute est configuré, il devient le provider par défaut de génération; sinon BuildFlow choisit le premier provider configuré. Le routage adaptatif et le fallback existants peuvent aussi basculer vers OmniRoute après une erreur d’un autre provider. Les requêtes portent `X-OmniRoute-No-Cache: true` pour éviter la mise en cache des prompts et du code utilisateur par le gateway. Les clés et l’URL ne sont jamais renvoyées à l’interface.

Le coût enregistré pour `auto` est une estimation générique lorsque BuildFlow ne reçoit pas de tarif exact par modèle; ce n’est pas une facture OmniRoute ni une mesure de coût garantie. Le gateway réel et sa clé ne sont pas encore configurés dans Netlify.
