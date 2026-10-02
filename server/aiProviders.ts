import { invokeLLM, type InvokeParams, type InvokeResult } from "./_core/llm";

export const AI_PROVIDER_IDS = [
  "manus",
  "openai",
  "google",
  "openrouter",
  "groq",
  "deepseek",
  "mistral",
  "ollama",
  "openai-compatible",
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

type ProviderDefinition = {
  id: AiProviderId;
  label: string;
  description: string;
  baseUrl?: string;
  baseUrlEnv?: string;
  apiKeyEnv?: string;
  defaultModel: string;
  models: string[];
  requiresKey: boolean;
};

const providerDefinitions: ProviderDefinition[] = [
  {
    id: "manus",
    label: "BuildFlow AI",
    description: "Proxy IA sécurisé de la plateforme BuildFlow",
    baseUrlEnv: "MANUS_API_URL",
    apiKeyEnv: "MANUS_API_KEY",
    defaultModel: "platform-default",
    models: ["platform-default"],
    requiresKey: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Modèles GPT via l’API OpenAI compatible chat completions",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    requiresKey: true,
  },
  {
    id: "google",
    label: "Google Gemini",
    description: "Modèles Gemini via l’API Generative Language",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKeyEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
    requiresKey: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "Accès unifié à de nombreux fournisseurs et modèles",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPEN_ROUTER_API_KEY",
    defaultModel: "openai/gpt-4o-mini",
    models: [
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-2.0-flash-001",
    ],
    requiresKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    description: "Inférence rapide compatible OpenAI",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    requiresKey: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "Modèles de raisonnement et de génération de code",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    requiresKey: true,
  },
  {
    id: "mistral",
    label: "Mistral",
    description: "Modèles européens pour le code et le texte",
    baseUrl: "https://api.mistral.ai/v1",
    apiKeyEnv: "MISTRAL_API_KEY",
    defaultModel: "mistral-small-latest",
    models: ["mistral-small-latest", "codestral-latest"],
    requiresKey: true,
  },
  {
    id: "ollama",
    label: "Ollama local",
    description: "Modèle local sans clé distante",
    baseUrlEnv: "OLLAMA_API_BASE_URL",
    apiKeyEnv: "OLLAMA_API_KEY",
    defaultModel: "llama3.2",
    models: ["llama3.2", "qwen2.5-coder:7b", "deepseek-coder-v2"],
    requiresKey: false,
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    description: "Endpoint personnalisé compatible avec l’API OpenAI",
    baseUrlEnv: "OPENAI_LIKE_API_BASE_URL",
    apiKeyEnv: "OPENAI_LIKE_API_KEY",
    defaultModel: "default",
    models: ["default"],
    requiresKey: false,
  },
];

const definitionFor = (id: AiProviderId) =>
  providerDefinitions.find(provider => provider.id === id) ??
  providerDefinitions[0];

const envValue = (name?: string) =>
  name ? process.env[name]?.trim() : undefined;

const resolvedBaseUrl = (provider: ProviderDefinition) =>
  envValue(provider.baseUrlEnv) || provider.baseUrl;

const configured = (provider: ProviderDefinition) => {
  const hasBaseUrl = Boolean(resolvedBaseUrl(provider));
  const hasKey = Boolean(envValue(provider.apiKeyEnv));
  return hasBaseUrl && (provider.requiresKey ? hasKey : true);
};

export function listAiProviders() {
  return providerDefinitions.map(provider => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
    configured: configured(provider),
    defaultModel: provider.defaultModel,
    models: provider.models,
    requiresKey: provider.requiresKey,
  }));
}

export function listAiModels(providerId: AiProviderId) {
  const provider = definitionFor(providerId);
  return {
    provider: provider.id,
    configured: configured(provider),
    models: provider.models,
    defaultModel: provider.defaultModel,
  };
}

function normalizeMessageContent(
  content: InvokeParams["messages"][number]["content"]
) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === "string") return { type: "text", text: part };
      return part;
    });
  }
  return content;
}

async function invokeOpenAiCompatible(
  providerId: AiProviderId,
  params: InvokeParams
): Promise<InvokeResult> {
  const provider = definitionFor(providerId);
  const baseUrl = resolvedBaseUrl(provider);
  const apiKey = envValue(provider.apiKeyEnv);
  if (!baseUrl) throw new Error(`${provider.label} n’est pas configuré.`);
  if (provider.requiresKey && !apiKey) {
    throw new Error(`La clé ${provider.apiKeyEnv} est manquante.`);
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: params.model || provider.defaultModel,
          messages: params.messages.map(message => ({
            role: message.role,
            content: normalizeMessageContent(message.content),
          })),
          ...(params.maxTokens || params.max_tokens
            ? { max_tokens: params.maxTokens ?? params.max_tokens }
            : {}),
          ...(params.tools?.length ? { tools: params.tools } : {}),
          ...(params.outputSchema || params.output_schema
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: params.outputSchema || params.output_schema,
                },
              }
            : {}),
        }),
      }
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `${provider.label} a répondu ${response.status}: ${detail.slice(0, 500)}`
      );
    }
    return (await response.json()) as InvokeResult;
  } finally {
    clearTimeout(timeout);
  }
}

async function invokeGemini(params: InvokeParams): Promise<InvokeResult> {
  const provider = definitionFor("google");
  const apiKey = envValue(provider.apiKeyEnv);
  if (!apiKey)
    throw new Error("La clé GOOGLE_GENERATIVE_AI_API_KEY est manquante.");
  const model = params.model || provider.defaultModel;
  const systemParts = params.messages
    .filter(message => message.role === "system")
    .map(message => ({
      text: String(normalizeMessageContent(message.content)),
    }));
  const contents = params.messages
    .filter(message => message.role !== "system")
    .map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(normalizeMessageContent(message.content)) }],
    }));
  const schema = params.outputSchema || params.output_schema;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(
      `${provider.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ...(systemParts.length
            ? { systemInstruction: { parts: systemParts } }
            : {}),
          contents,
          generationConfig: {
            ...(params.maxTokens || params.max_tokens
              ? { maxOutputTokens: params.maxTokens ?? params.max_tokens }
              : {}),
            ...(schema
              ? {
                  responseMimeType: "application/json",
                  responseSchema: schema.schema,
                }
              : {}),
          },
        }),
      }
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Google Gemini a répondu ${response.status}: ${detail.slice(0, 500)}`
      );
    }
    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };
    const content =
      data.candidates?.[0]?.content?.parts
        ?.map(part => part.text ?? "")
        .join("\n") ?? "";
    return {
      id: `gemini-${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: data.usageMetadata
        ? {
            prompt_tokens: data.usageMetadata.promptTokenCount ?? 0,
            completion_tokens: data.usageMetadata.candidatesTokenCount ?? 0,
            total_tokens: data.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function invokeConfiguredLLM(
  providerId: AiProviderId = "manus",
  params: InvokeParams
): Promise<InvokeResult> {
  if (providerId === "manus") return invokeLLM(params);
  if (providerId === "google") return invokeGemini(params);
  return invokeOpenAiCompatible(providerId, params);
}

export async function* streamConfiguredLLM(
  providerId: AiProviderId = "manus",
  params: InvokeParams
): AsyncGenerator<string> {
  if (providerId === "manus") {
    const result = await invokeLLM(params);
    const content = result.choices[0]?.message.content;
    yield typeof content === "string" ? content : JSON.stringify(content ?? "");
    return;
  }

  if (providerId === "google") {
    const provider = definitionFor("google");
    const apiKey = envValue(provider.apiKeyEnv);
    if (!apiKey) throw new Error("La clé GOOGLE_GENERATIVE_AI_API_KEY est manquante.");
    const model = params.model || provider.defaultModel;
    const systemParts = params.messages.filter(message => message.role === "system").map(message => ({ text: String(normalizeMessageContent(message.content)) }));
    const contents = params.messages.filter(message => message.role !== "system").map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(normalizeMessageContent(message.content)) }],
    }));
    const response = await fetch(
      `${provider.baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
          contents,
          generationConfig: {
            ...(params.maxTokens || params.max_tokens ? { maxOutputTokens: params.maxTokens ?? params.max_tokens } : {}),
            ...(params.outputSchema ? { responseMimeType: "application/json", responseSchema: params.outputSchema.schema } : {}),
          },
        }),
      }
    );
    if (!response.ok) throw new Error(`Google Gemini a répondu ${response.status}: ${(await response.text()).slice(0, 500)}`);
    yield* parseSseText(response, chunk => {
      const parts = (chunk as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts ?? [];
      return parts.map(part => part.text ?? "").join("");
    });
    return;
  }

  const provider = definitionFor(providerId);
  const baseUrl = resolvedBaseUrl(provider);
  const apiKey = envValue(provider.apiKeyEnv);
  if (!baseUrl) throw new Error(`${provider.label} n’est pas configuré.`);
  if (provider.requiresKey && !apiKey) throw new Error(`La clé ${provider.apiKeyEnv} est manquante.`);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({
      model: params.model || provider.defaultModel,
      messages: params.messages.map(message => ({ role: message.role, content: normalizeMessageContent(message.content) })),
      stream: true,
      ...(params.maxTokens || params.max_tokens ? { max_tokens: params.maxTokens ?? params.max_tokens } : {}),
      ...(params.outputSchema ? { response_format: { type: "json_schema", json_schema: params.outputSchema } } : {}),
    }),
  });
  if (!response.ok) throw new Error(`${provider.label} a répondu ${response.status}: ${(await response.text()).slice(0, 500)}`);
  yield* parseSseText(response, chunk => {
    const delta = (chunk as { choices?: Array<{ delta?: { content?: string } }> }).choices?.[0]?.delta?.content;
    return delta ?? "";
  });
}

async function* parseSseText(
  response: Response,
  extract: (chunk: unknown) => string
): AsyncGenerator<string> {
  if (!response.body) throw new Error("Le provider n’a pas retourné de flux lisible.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const event of events) {
        const data = event.split(/\r?\n/).find(line => line.startsWith("data:"))?.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const text = extract(JSON.parse(data));
          if (text) yield text;
        } catch {
          // Ignore keep-alive or malformed SSE frames; the final provider response remains authoritative.
        }
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function testAiProvider(providerId: AiProviderId) {
  const startedAt = Date.now();
  await invokeConfiguredLLM(providerId, {
    model: definitionFor(providerId).defaultModel,
    messages: [
      { role: "system", content: "Réponds uniquement par OK." },
      { role: "user", content: "Test de connexion." },
    ],
    maxTokens: 8,
  });
  return {
    provider: providerId,
    ok: true as const,
    latencyMs: Date.now() - startedAt,
  };
}
