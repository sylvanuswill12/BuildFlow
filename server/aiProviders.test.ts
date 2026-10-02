import { afterEach, describe, expect, it, vi } from "vitest";
import { listAiModels, listAiProviders, streamConfiguredLLM } from "./aiProviders";

const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalManusKey = process.env.MANUS_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;
  if (originalManusKey === undefined) delete process.env.MANUS_API_KEY;
  else process.env.MANUS_API_KEY = originalManusKey;
});

describe("AI provider catalog", () => {
  it("exposes supported providers without exposing API keys", () => {
    process.env.OPENAI_API_KEY = "test-key";
    const providers = listAiProviders();
    const openai = providers.find(provider => provider.id === "openai");

    expect(openai).toMatchObject({
      id: "openai",
      configured: true,
      defaultModel: "gpt-4o-mini",
    });
    expect(JSON.stringify(providers)).not.toContain("test-key");
  });

  it("returns a safe model catalog for a provider", () => {
    const models = listAiModels("ollama");
    expect(models.provider).toBe("ollama");
    expect(models.models).toContain("llama3.2");
    expect(models).not.toHaveProperty("apiKey");
  });

  it("reassembles OpenAI-compatible SSE content fragments", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Bon"}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"jour"}}]}\n\ndata: [DONE]\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    const chunks: string[] = [];
    for await (const chunk of streamConfiguredLLM("openai", {
      messages: [{ role: "user", content: "Dis bonjour" }],
    })) chunks.push(chunk);
    expect(chunks.join("")).toBe("Bonjour");
  });
});
