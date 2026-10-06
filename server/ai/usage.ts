import type { InvokeParams, InvokeResult, MessageContent } from "../aiTypes";
import type { AiProviderId } from "../aiProviders";
import { estimateTokenCount, type AiInvocationMetadata } from "./routing";

export type EstimatedUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
  tokenCountsEstimated: boolean;
};

const RATE_PER_MILLION: Record<AiProviderId, { input: number; output: number }> = {
  openai: { input: 1, output: 4 },
  anthropic: { input: 3, output: 15 },
  google: { input: 0.5, output: 2 },
  openrouter: { input: 2, output: 8 },
  omniroute: { input: 1, output: 4 },
  groq: { input: 0.6, output: 0.8 },
  deepseek: { input: 0.3, output: 1.2 },
  mistral: { input: 1, output: 3 },
  ollama: { input: 0, output: 0 },
  "openai-compatible": { input: 1, output: 4 },
};

function pricing(provider: AiProviderId, model: string) {
  const name = model.toLowerCase();
  if (provider === "openai") {
    if (name.includes("4o-mini")) return { input: 0.15, output: 0.6 };
    if (name.includes("4.1-mini")) return { input: 0.4, output: 1.6 };
    if (name.includes("gpt-4o")) return { input: 2.5, output: 10 };
    if (name.includes("gpt-4.1")) return { input: 2, output: 8 };
  }
  if (provider === "anthropic") {
    if (name.includes("haiku")) return { input: 0.8, output: 4 };
    if (name.includes("opus")) return { input: 15, output: 75 };
    if (name.includes("sonnet")) return { input: 3, output: 15 };
  }
  if (provider === "google") {
    if (name.includes("flash")) return { input: 0.1, output: 0.4 };
    if (name.includes("pro")) return { input: 1.25, output: 5 };
  }
  return RATE_PER_MILLION[provider];
}

function partsText(content: MessageContent | MessageContent[]): { text: string; images: number } {
  const parts = Array.isArray(content) ? content : [content];
  let text = "";
  let images = 0;
  for (const part of parts) {
    if (typeof part === "string") text += part;
    else if (part.type === "text") text += part.text;
    else if (part.type === "file_url") text += part.file_url.url;
    else if (part.type === "image_url") images += 1;
  }
  return { text, images };
}

export function estimateGenerationUsage(
  provider: AiProviderId,
  model: string,
  params: InvokeParams,
  outputText: string,
  result?: InvokeResult
): EstimatedUsage {
  const actual = result?.usage;
  const tokenCountsEstimated = !actual || (actual.prompt_tokens === 0 && actual.completion_tokens === 0);
  let inputTokens = actual?.prompt_tokens ?? 0;
  let outputTokens = actual?.completion_tokens ?? 0;
  if (tokenCountsEstimated) {
    inputTokens = params.messages.reduce((sum, message) => {
      const content = partsText(message.content);
      return sum + estimateTokenCount(content.text) + content.images * 768;
    }, 0);
    outputTokens = estimateTokenCount(outputText);
  }
  const rate = pricing(provider, model);
  const estimatedCostMicros = Math.round((inputTokens * rate.input + outputTokens * rate.output) / 1_000_000 * 1_000_000);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostMicros: Number.isFinite(estimatedCostMicros) ? estimatedCostMicros : 0,
    tokenCountsEstimated,
  };
}

export function usageRecordFields(
  metadata: AiInvocationMetadata,
  params: InvokeParams,
  outputText: string,
  result?: InvokeResult
) {
  return {
    provider: metadata.provider,
    model: metadata.model,
    complexity: metadata.complexity,
    latencyMs: metadata.latencyMs,
    fallbackFrom: metadata.fallbackFrom ?? null,
    ...estimateGenerationUsage(metadata.provider, metadata.model, params, outputText, result),
  };
}
