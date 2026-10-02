# Providers IA BuildFlow

BuildFlow utilise une couche serveur multi-provider inspirée de Bolt.diy. Les clés restent côté serveur et ne sont jamais renvoyées par l’API `ai.providers`.

## Providers actuellement branchés à la génération

- `manus` — provider BuildFlow par défaut (`MANUS_API_URL`, `MANUS_API_KEY`)
- `openai` — `OPENAI_API_KEY`
- `google` — `GOOGLE_GENERATIVE_AI_API_KEY` via l’API Gemini native
- `openrouter` — `OPEN_ROUTER_API_KEY`
- `groq` — `GROQ_API_KEY`
- `deepseek` — `DEEPSEEK_API_KEY`
- `mistral` — `MISTRAL_API_KEY`
- `ollama` — `OLLAMA_API_BASE_URL` facultatif, par défaut local
- `openai-compatible` — `OPENAI_LIKE_API_BASE_URL` et `OPENAI_LIKE_API_KEY` facultatif

Les providers distants utilisent le format OpenAI Chat Completions, à l’exception de Google Gemini qui utilise son adaptateur REST natif `generateContent`. Le provider Anthropic reste réservé à une prochaine tranche avec son adaptateur natif.

## APIs tRPC

- `ai.providers` : retourne le catalogue et l’état de configuration sans clé secrète.
- `ai.models` : retourne les modèles disponibles pour un provider.
- `ai.testConnection` : exécute un test réel authentifié sur le provider choisi.
- `projects.generateChange` : accepte `provider` et `model`, puis génère le patch multi-fichiers avec le provider demandé.

## Exemple de configuration

```env
MANUS_API_URL=https://...
MANUS_API_KEY=...
OPENAI_API_KEY=...
OLLAMA_API_BASE_URL=http://127.0.0.1:11434/v1
```

Ne jamais utiliser un préfixe `VITE_` pour une clé privée. Les clés doivent rester dans l’environnement du serveur.
