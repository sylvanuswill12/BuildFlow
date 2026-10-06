import type { InvokeParams, InvokeResult } from "../aiTypes";
import {
  AI_PROVIDER_IDS,
  invokeConfiguredLLM,
  listAiModels,
  listAiProviders,
  streamConfiguredLLM,
  type AiProviderId,
} from "../aiProviders";

export type TaskComplexity = "low" | "medium" | "high";
export type AiInvocationMetadata = {
  provider: AiProviderId;
  model: string;
  complexity: TaskComplexity;
  latencyMs: number;
  fallbackFrom?: AiProviderId;
};
export type RoutingOptions = {
  smartModelRouting?: boolean;
  providerFallback?: boolean;
  prompt?: string;
  currentFiles?: Record<string, string>;
};

const MODEL_TIERS: Partial<Record<AiProviderId, Record<TaskComplexity, string>>> = {
  openai: { low: "gpt-4o-mini", medium: "gpt-4.1-mini", high: "gpt-4o" },
  anthropic: { low: "claude-haiku-4-5", medium: "claude-sonnet-5-5", high: "claude-opus-5-5" },
  google: { low: "gemini-2.0-flash", medium: "gemini-1.5-pro", high: "gemini-1.5-pro" },
  openrouter: { low: "openai/gpt-4o-mini", medium: "anthropic/claude-3.5-sonnet", high: "anthropic/claude-3.5-sonnet" },
  omniroute: { low: "auto", medium: "auto", high: "auto" },
  groq: { low: "llama-3.1-8b-instant", medium: "llama-3.3-70b-versatile", high: "llama-3.3-70b-versatile" },
  deepseek: { low: "deepseek-chat", medium: "deepseek-chat", high: "deepseek-reasoner" },
  mistral: { low: "mistral-small-latest", medium: "codestral-latest", high: "codestral-latest" },
  ollama: { low: "qwen2.5-coder:7b", medium: "deepseek-coder-v2", high: "deepseek-coder-v2" },
  "openai-compatible": { low: "default", medium: "default", high: "default" },
};

export function classifyTaskComplexity(prompt: string, files: Record<string, string> = {}): TaskComplexity {
  const normalized = prompt.toLowerCase();
  const fileEntries = Object.entries(files);
  const totalChars = fileEntries.reduce((sum, [, content]) => sum + content.length, 0);
  let score = 0;
  if (prompt.length > 600) score += 2;
  if (prompt.length > 1_400) score += 2;
  if (fileEntries.length > 4) score += 1;
  if (fileEntries.length > 12) score += 2;
  if (totalChars > 16_000) score += 1;
  if (totalChars > 60_000) score += 2;
  if (/architecture|refactor|migrat|multi.?page|auth|database|payment|stripe|websocket|performance|security|concurren|rollback|integration|implement.*end.to.end/.test(normalized)) score += 3;
  if (/fix|repair|debug|error|stack trace|build failed|type error|test failed/.test(normalized)) score += 2;
  if (/change (?:the )?(?:color|text|label)|rename|small tweak|typo|padding/.test(normalized)) score -= 2;
  if (score >= 6) return "high";
  if (score <= 1) return "low";
  return "medium";
}

function selectedModel(provider: AiProviderId, complexity: TaskComplexity, smart: boolean, explicit?: string) {
  if (explicit) return explicit;
  if (!smart) return listAiModels(provider).defaultModel;
  const proposed = MODEL_TIERS[provider]?.[complexity];
  const allowed = listAiModels(provider).models;
  return proposed && allowed.includes(proposed) ? proposed : listAiModels(provider).defaultModel;
}

function providersToTry(primary: AiProviderId, enabled: boolean, needsVision: boolean): AiProviderId[] {
  if (!enabled) return [primary];
  const configured = new Set(listAiProviders().filter(provider => provider.configured && (!needsVision || provider.supportsVision)).map(provider => provider.id));
  const envOrder = (process.env.AI_FALLBACK_PROVIDERS ?? "")
    .split(",").map(value => value.trim()).filter((value): value is AiProviderId => (AI_PROVIDER_IDS as readonly string[]).includes(value));
  const defaultOrder: AiProviderId[] = ["omniroute", "openai", "anthropic", "google", "openrouter", "groq", "deepseek", "mistral", "ollama", "openai-compatible"];
  const alternatives = (envOrder.length ? envOrder : defaultOrder).filter(id => id !== primary && configured.has(id)).slice(0, 2);
  return [primary, ...alternatives];
}

function requestNeedsVision(params: InvokeParams): boolean {
  return params.messages.some(message => {
    const content = Array.isArray(message.content) ? message.content : [message.content];
    return content.some(part => typeof part === "object" && part !== null && part.type === "image_url");
  });
}

function requestModel(provider: AiProviderId, params: InvokeParams, complexity: TaskComplexity, options: RoutingOptions) {
  return selectedModel(provider, complexity, options.smartModelRouting === true, params.model);
}

export async function invokeRoutedLLM(
  primaryProvider: AiProviderId,
  params: InvokeParams,
  options: RoutingOptions = {}
): Promise<{ result: InvokeResult; metadata: AiInvocationMetadata }> {
  const complexity = classifyTaskComplexity(options.prompt ?? "", options.currentFiles ?? {});
  const candidates = providersToTry(primaryProvider, options.providerFallback === true, requestNeedsVision(params));
  let lastError: unknown;
  for (const provider of candidates) {
    const model = requestModel(provider, provider === primaryProvider ? params : { ...params, model: undefined }, complexity, options);
    const startedAt = Date.now();
    try {
      const result = await invokeConfiguredLLM(provider, {
        ...params,
        model,
        signal: params.signal ?? AbortSignal.timeout(60_000),
      });
      return {
        result,
        metadata: {
          provider,
          model: result.model || model,
          complexity,
          latencyMs: Date.now() - startedAt,
          ...(provider !== primaryProvider ? { fallbackFrom: primaryProvider } : {}),
        },
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Tous les providers IA configurés ont échoué.");
}

export async function* streamRoutedLLM(
  primaryProvider: AiProviderId,
  params: InvokeParams,
  options: RoutingOptions = {},
  onResolved?: (metadata: AiInvocationMetadata) => void
): AsyncGenerator<string> {
  const complexity = classifyTaskComplexity(options.prompt ?? "", options.currentFiles ?? {});
  const candidates = providersToTry(primaryProvider, options.providerFallback === true, requestNeedsVision(params));
  let lastError: unknown;
  for (const provider of candidates) {
    const model = requestModel(provider, provider === primaryProvider ? params : { ...params, model: undefined }, complexity, options);
    const startedAt = Date.now();
    let emittedChunk = false;
    try {
      for await (const chunk of streamConfiguredLLM(provider, {
        ...params,
        model,
        signal: params.signal ?? AbortSignal.timeout(60_000),
      })) {
        emittedChunk = true;
        yield chunk;
      }
      onResolved?.({
        provider,
        model,
        complexity,
        latencyMs: Date.now() - startedAt,
        ...(provider !== primaryProvider ? { fallbackFrom: primaryProvider } : {}),
      });
      return;
    } catch (error) {
      lastError = error;
      // Once content has been sent to the client, retrying would duplicate actions.
      if (emittedChunk) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Tous les providers IA configurés ont échoué.");
}

export function estimateTokenCount(text: string): number {
  return text.trim() ? Math.max(1, Math.ceil(text.length / 4)) : 0;
}
