import { describe, expect, it } from "vitest";
import { buildConversationContext } from "./messageHistory";

describe("conversation context window", () => {
  it("keeps the latest user and assistant exchanges in order", () => {
    const context = buildConversationContext([
      { role: "user", content: "one" },
      { role: "assistant", content: "two" },
      { role: "user", content: "three" },
      { role: "assistant", content: "four" },
    ], { windowSize: 2 });
    expect(context.recent.map(item => item.content)).toEqual(["three", "four"]);
    expect(context.summary).toContain("Demande : one");
    expect(context.summary).toContain("Réponse : two");
  });
  it("bounds recent context size and preserves action labels in the summary", () => {
    const messages = Array.from({ length: 6 }, (_, index) => ({
      role: index % 2 ? "assistant" as const : "user" as const,
      content: `Message ${index} `.repeat(120),
      actions: index === 0 ? ["src/App.tsx créé"] : undefined,
    }));
    const context = buildConversationContext(messages, { windowSize: 5, charBudget: 1_000 });
    expect(context.recent.length).toBeLessThan(5);
    expect(context.summary).toContain("src/App.tsx créé");
    expect(context.recent.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(1_000);
  });
  it("returns no summary for a short conversation", () => {
    const context = buildConversationContext([{ role: "user", content: "Create a todo app" }]);
    expect(context.summary).toBeUndefined();
    expect(context.recent).toHaveLength(1);
  });
});
