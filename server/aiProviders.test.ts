import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfiguredAiProvider, invokeConfiguredLLM, listAiModels, listAiProviders, streamConfiguredLLM, toAnthropicContent, toGeminiParts } from "./aiProviders";

const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
const originalOmniRouteBaseUrl = process.env.OMNIROUTE_API_BASE_URL;
const originalOmniRouteApiKey = process.env.OMNIROUTE_API_KEY;
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;
  if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  if (originalOmniRouteBaseUrl === undefined) delete process.env.OMNIROUTE_API_BASE_URL;
  else process.env.OMNIROUTE_API_BASE_URL = originalOmniRouteBaseUrl;
  if (originalOmniRouteApiKey === undefined) delete process.env.OMNIROUTE_API_KEY;
  else process.env.OMNIROUTE_API_KEY = originalOmniRouteApiKey;
});

describe("AI provider catalog", () => {
  it("exposes supported providers without exposing API keys", () => {
    process.env.OPENAI_API_KEY = "test-key";
    const providers = listAiProviders();
    const openai = providers.find(provider => provider.id === "openai");
    expect(openai).toMatchObject({ id: "openai", configured: true, defaultModel: "gpt-4o-mini" });
    expect(JSON.stringify(providers)).not.toContain("test-key");
    expect(providers).toHaveLength(10);
  });
  it("prefers a configured OmniRoute gateway and never exposes its server key", () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    process.env.OMNIROUTE_API_BASE_URL = "https://omni.example/v1";
    process.env.OMNIROUTE_API_KEY = "omniroute-server-test-key";
    const providers = listAiProviders();
    expect(providers.find(provider => provider.id === "omniroute")).toMatchObject({
      configured: true,
      defaultModel: "auto",
      models: ["auto"],
      requiresKey: true,
    });
    expect(defaultConfiguredAiProvider()).toBe("omniroute");
    expect(listAiModels("omniroute").models).toEqual(["auto"]);
    expect(JSON.stringify(providers)).not.toContain("omniroute-server-test-key");
  });
  it("sends OmniRoute chat completions with Bearer auth and cache bypass", async () => {
    process.env.OMNIROUTE_API_BASE_URL = "https://omni.example/v1";
    process.env.OMNIROUTE_API_KEY = "omniroute-server-test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "omni-ok",
      created: 1,
      model: "auto",
      choices: [{ index: 0, message: { role: "assistant", content: "Réponse" }, finish_reason: "stop" }],
    }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await invokeConfiguredLLM("omniroute", {
      messages: [{ role: "user", content: "Vérifie la connexion" }],
    });
    expect(result.choices[0]?.message.content).toBe("Réponse");
    expect(fetchMock).toHaveBeenCalledWith("https://omni.example/v1/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        authorization: "Bearer omniroute-server-test-key",
        "X-OmniRoute-No-Cache": "true",
      }),
    }));
  });
  it("streams OmniRoute SSE using its auto model and server-only credentials", async () => {
    process.env.OMNIROUTE_API_BASE_URL = "https://omni.example/v1";
    process.env.OMNIROUTE_API_KEY = "omniroute-server-test-key";
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Flux"}}]}\n\ndata: [DONE]\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream));
    vi.stubGlobal("fetch", fetchMock);
    const chunks: string[] = [];
    for await (const chunk of streamConfiguredLLM("omniroute", {
      messages: [{ role: "user", content: "Génère" }],
    })) chunks.push(chunk);
    expect(chunks.join("")).toBe("Flux");
    expect(fetchMock).toHaveBeenCalledWith("https://omni.example/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({
        authorization: "Bearer omniroute-server-test-key",
        "X-OmniRoute-No-Cache": "true",
      }),
    }));
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string).model).toBe("auto");
  });
  it("returns a safe model catalog for a provider", () => {
    const models = listAiModels("ollama");
    expect(models.provider).toBe("ollama");
    expect(models.models).toContain("llama3.2");
    expect(models).not.toHaveProperty("apiKey");
  });
  it("converts data URLs into Gemini inlineData blocks", () => {
    expect(toGeminiParts([
      { type: "image_url", image_url: { url: "data:image/png;base64,AQID" } },
      { type: "text", text: "Describe it" },
    ])).toEqual([{ inlineData: { mimeType: "image/png", data: "AQID" } }, { text: "Describe it" }]);
  });
  it("converts data URLs into Anthropic base64 image blocks", () => {
    expect(toAnthropicContent([
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,AQID" } },
      { type: "text", text: "Describe it" },
    ])).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AQID" } },
      { type: "text", text: "Describe it" },
    ]);
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
    for await (const chunk of streamConfiguredLLM("openai", { messages: [{ role: "user", content: "Dis bonjour" }] })) chunks.push(chunk);
    expect(chunks.join("")).toBe("Bonjour");
  });
  it("uses the native Anthropic Messages SSE format and keeps its key server-side", async () => {
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Claude"}}\n\n'));
        controller.enqueue(new TextEncoder().encode('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":" stream"}}\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream));
    vi.stubGlobal("fetch", fetchMock);
    const chunks: string[] = [];
    for await (const chunk of streamConfiguredLLM("anthropic", { model: "claude-sonnet-5-5", messages: [{ role: "user", content: "Dis bonjour" }] })) chunks.push(chunk);
    expect(chunks.join("")).toBe("Claude stream");
    expect(fetchMock).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", expect.objectContaining({
      headers: expect.objectContaining({ "x-api-key": "test-anthropic-key", "anthropic-version": "2023-06-01" }),
    }));
    expect(JSON.stringify(listAiProviders())).not.toContain("test-anthropic-key");
  });
});
