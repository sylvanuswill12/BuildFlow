import type { FileContent, ImageContent, InvokeParams, InvokeResult, TextContent } from "./aiTypes";

export const AI_PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "omniroute",
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
  supportsVision: boolean;
};

const providerDefinitions: ProviderDefinition[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "Modèles GPT via l’API OpenAI compatible chat completions",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    requiresKey: true,
    supportsVision: true,
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    description: "Claude via l’API native Messages et son flux SSE",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5-5",
    models: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-4-5"],
    requiresKey: true,
    supportsVision: true,
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
    supportsVision: true,
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
    supportsVision: true,
  },
  {
    id: "omniroute",
    label: "OmniRoute",
    description: "Passerelle auto-hébergée avec routage automatique des modèles",
    baseUrlEnv: "OMNIROUTE_API_BASE_URL",
    apiKeyEnv: "OMNIROUTE_API_KEY",
    defaultModel: "auto",
    models: ["auto"],
    requiresKey: true,
    supportsVision: true,
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
    supportsVision: false,
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
    supportsVision: false,
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
    supportsVision: false,
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
    supportsVision: false,
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
    supportsVision: false,
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

export function defaultConfiguredAiProvider(): AiProviderId {
  const preferred: AiProviderId[] = ["omniroute", "openai", "anthropic", "google", "openrouter", "groq", "mistral", "deepseek", "ollama", "openai-compatible"];
  return preferred.find(id => configured(definitionFor(id))) ?? "openai";
}

export function listAiProviders() {
  return providerDefinitions.map(provider => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
    configured: configured(provider),
    defaultModel: provider.defaultModel,
    models: provider.models,
    requiresKey: provider.requiresKey,
    supportsVision: provider.supportsVision,
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

type ContentPart = TextContent | ImageContent | FileContent;
type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
type AnthropicBlock = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

function normalizeMessageContent(
  content: InvokeParams["messages"][number]["content"]
): string | ContentPart | ContentPart[] {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === "string") return { type: "text" as const, text: part };
      return part;
    });
  }
  return content;
}

function contentParts(content: InvokeParams["messages"][number]["content"]): ContentPart[] {
  const normalized = normalizeMessageContent(content);
  if (typeof normalized === "string") return [{ type: "text", text: normalized }];
  return Array.isArray(normalized) ? normalized as ContentPart[] : [normalized as ContentPart];
}

function dataUrlImage(url: string) {
  const match = url.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)$/i);
  return match ? { mimeType: match[1]!, data: match[2]! } : null;
}

export function toGeminiParts(content: InvokeParams["messages"][number]["content"]): GeminiPart[] {
  const result: GeminiPart[] = [];
  for (const part of contentParts(content)) {
    if (part.type === "text") result.push({ text: part.text });
    if (part.type === "image_url") {
      const image = dataUrlImage(part.image_url.url);
      if (image) result.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    }
    if (part.type === "file_url") result.push({ text: `[Fichier joint : ${part.file_url.url}]` });
  }
  return result;
}

export function toAnthropicContent(content: InvokeParams["messages"][number]["content"]): AnthropicBlock[] {
  const result: AnthropicBlock[] = [];
  for (const part of contentParts(content)) {
    if (part.type === "text") result.push({ type: "text", text: part.text });
    if (part.type === "image_url") {
      const image = dataUrlImage(part.image_url.url);
      if (image) result.push({ type: "image", source: { type: "base64", media_type: image.mimeType, data: image.data } });
    }
    if (part.type === "file_url") result.push({ type: "text", text: `[Fichier joint : ${part.file_url.url}]` });
  }
  return result;
}

function messageText(content: InvokeParams["messages"][number]["content"]) {
  return contentParts(content).flatMap(part => typeof part === "object" && "text" in part ? [part.text] : []).join("\n");
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
  if (providerId === "omniroute") headers["X-OmniRoute-No-Cache"] = "true";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers,
        signal: params.signal ?? controller.signal,
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
    .map(message => ({ text: messageText(message.content) }));
  const contents = params.messages
    .filter(message => message.role !== "system")
    .map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: toGeminiParts(message.content),
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
        signal: params.signal ?? controller.signal,
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

async function invokeAnthropic(params: InvokeParams): Promise<InvokeResult> {
  const provider = definitionFor("anthropic");
  const apiKey = envValue(provider.apiKeyEnv);
  if (!apiKey) throw new Error("La clé ANTHROPIC_API_KEY est manquante.");
  const system = params.messages.filter(message => message.role === "system")
    .map(message => messageText(message.content)).join("\n\n");
  const messages = params.messages.filter(message => message.role !== "system")
    .map(message => ({ role: message.role === "assistant" ? "assistant" : "user", content: toAnthropicContent(message.content) }));
  const response = await fetch(`${provider.baseUrl}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": apiKey },
    signal: params.signal,
    body: JSON.stringify({ model: params.model || provider.defaultModel, max_tokens: params.maxTokens ?? params.max_tokens ?? 12_000, ...(system ? { system } : {}), messages, stream: false }),
  });
  if (!response.ok) throw new Error(`Anthropic a répondu ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const data = await response.json() as { id?: string; model?: string; content?: Array<{ type?: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
  const text = data.content?.filter(block => block.type === "text").map(block => block.text ?? "").join("\n") ?? "";
  const promptTokens = data.usage?.input_tokens ?? 0;
  const completionTokens = data.usage?.output_tokens ?? 0;
  return {
    id: data.id ?? `anthropic-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: data.model ?? params.model ?? provider.defaultModel,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
  };
}

export async function invokeConfiguredLLM(
  providerId: AiProviderId = "openai",
  params: InvokeParams
): Promise<InvokeResult> {
  if (providerId === "google") return invokeGemini(params);
  if (providerId === "anthropic") return invokeAnthropic(params);
  return invokeOpenAiCompatible(providerId, params);
}

export async function* streamConfiguredLLM(
  providerId: AiProviderId = "openai",
  params: InvokeParams
): AsyncGenerator<string> {

  if (providerId === "anthropic") {
    const provider = definitionFor("anthropic");
    const apiKey = envValue(provider.apiKeyEnv);
    if (!apiKey) throw new Error("La clé ANTHROPIC_API_KEY est manquante.");
    const system = params.messages.filter(message => message.role === "system")
      .map(message => messageText(message.content)).join("\n\n");
    const messages = params.messages.filter(message => message.role !== "system")
      .map(message => ({ role: message.role === "assistant" ? "assistant" : "user", content: toAnthropicContent(message.content) }));
    const response = await fetch(`${provider.baseUrl}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": apiKey },
      signal: params.signal,
      body: JSON.stringify({ model: params.model || provider.defaultModel, max_tokens: params.maxTokens ?? params.max_tokens ?? 12_000, ...(system ? { system } : {}), messages, stream: true }),
    });
    if (!response.ok) throw new Error(`Anthropic a répondu ${response.status}: ${(await response.text()).slice(0, 500)}`);
    yield* parseSseText(response, chunk => {
      const event = chunk as { type?: string; delta?: { type?: string; text?: string } };
      return event.type === "content_block_delta" && event.delta?.type === "text_delta" ? event.delta.text ?? "" : "";
    });
    return;
  }

  if (providerId === "google") {
    const provider = definitionFor("google");
    const apiKey = envValue(provider.apiKeyEnv);
    if (!apiKey) throw new Error("La clé GOOGLE_GENERATIVE_AI_API_KEY est manquante.");
    const model = params.model || provider.defaultModel;
    const systemParts = params.messages.filter(message => message.role === "system").map(message => ({ text: messageText(message.content) }));
    const contents = params.messages.filter(message => message.role !== "system").map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: toGeminiParts(message.content),
    }));
    const response = await fetch(
      `${provider.baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: params.signal,
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
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      ...(providerId === "omniroute" ? { "X-OmniRoute-No-Cache": "true" } : {}),
    },
    signal: params.signal,
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
