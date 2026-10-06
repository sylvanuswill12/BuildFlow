import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeRoutedLLM, classifyTaskComplexity } from "./routing";
import { estimateGenerationUsage } from "./usage";

const saved = {
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  omniBaseUrl: process.env.OMNIROUTE_API_BASE_URL,
  omniApiKey: process.env.OMNIROUTE_API_KEY,
};
afterEach(() => {
  vi.unstubAllGlobals();
  if (saved.openai === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = saved.openai;
  if (saved.anthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = saved.anthropic;
  if (saved.omniBaseUrl === undefined) delete process.env.OMNIROUTE_API_BASE_URL;
  else process.env.OMNIROUTE_API_BASE_URL = saved.omniBaseUrl;
  if (saved.omniApiKey === undefined) delete process.env.OMNIROUTE_API_KEY;
  else process.env.OMNIROUTE_API_KEY = saved.omniApiKey;
});

describe("adaptive AI routing", () => {
  it("classifies simple edits as low and architecture/refactor work as high", () => {
    expect(classifyTaskComplexity("Change the button color", {})).toBe("low");
    expect(classifyTaskComplexity("Refactor the authentication and database architecture with migrations", { "src/App.tsx": "x".repeat(70_000) })).toBe("high");
  });

  it("uses an affordable task-tier model when intelligent routing is enabled", async () => {
    process.env.OPENAI_API_KEY = "unit-test";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "ok", created: 1, model: "gpt-4o-mini", choices: [{ index: 0, message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
    }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const call = await invokeRoutedLLM("openai", { messages: [{ role: "user", content: "Rename a button" }] }, { smartModelRouting: true, prompt: "Rename a button" });
    expect(call.metadata.model).toBe("gpt-4o-mini");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string).model).toBe("gpt-4o-mini");
  });

  it("falls back to a configured provider after a primary request failure", async () => {
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.ANTHROPIC_API_KEY = "anthropic-test";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("temporarily unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "claude-ok", model: "claude-sonnet-5-5", content: [{ type: "text", text: "Recovered" }], usage: { input_tokens: 20, output_tokens: 4 },
      }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const call = await invokeRoutedLLM("openai", { model: "gpt-4o", messages: [{ role: "user", content: "Generate" }] }, { providerFallback: true, prompt: "Generate" });
    expect(call.metadata).toMatchObject({ provider: "anthropic", model: "claude-sonnet-5-5", fallbackFrom: "openai" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to OmniRoute auto and estimates its usage", async () => {
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.OMNIROUTE_API_BASE_URL = "https://omni.example/v1";
    process.env.OMNIROUTE_API_KEY = "omniroute-test";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("temporarily unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "omni-ok",
        created: 1,
        model: "auto",
        choices: [{ index: 0, message: { role: "assistant", content: "Recovered" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 20, completion_tokens: 4, total_tokens: 24 },
      }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const call = await invokeRoutedLLM("openai", {
      model: "gpt-4o",
      messages: [{ role: "user", content: "Rename a button" }],
    }, { providerFallback: true, smartModelRouting: true, prompt: "Rename a button" });
    expect(call.metadata).toMatchObject({ provider: "omniroute", model: "auto", fallbackFrom: "openai" });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string).model).toBe("auto");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://omni.example/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({
        authorization: "Bearer omniroute-test",
        "X-OmniRoute-No-Cache": "true",
      }),
    }));
    expect(estimateGenerationUsage("omniroute", "auto", {
      messages: [{ role: "user", content: "abcd" }],
    }, "abcdefghij")).toMatchObject({ estimatedCostMicros: 13, tokenCountsEstimated: true });
  });

  it("estimates cost in micro-USD and distinguishes provider token estimates", () => {
    const estimate = estimateGenerationUsage("openai", "gpt-4o-mini", {
      messages: [{ role: "user", content: "abcd" }],
    }, "abcdefghij");
    expect(estimate).toMatchObject({ inputTokens: 1, outputTokens: 3, totalTokens: 4, estimatedCostMicros: 2, tokenCountsEstimated: true });
    const reported = estimateGenerationUsage("anthropic", "claude-sonnet-5-5", {
      messages: [{ role: "user", content: "prompt" }],
    }, "answer", { id: "x", created: 1, model: "claude-sonnet-5-5", choices: [], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } });
    expect(reported).toMatchObject({ inputTokens: 100, outputTokens: 20, totalTokens: 120, tokenCountsEstimated: false });
  });
});
