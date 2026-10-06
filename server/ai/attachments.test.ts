import { describe, expect, it } from "vitest";
import { attachImagesToLastUserMessage } from "./attachments";

describe("generation image blocks", () => {
  it("adds base64 image blocks before the latest user text", () => {
    const messages = attachImagesToLastUserMessage([
      { role: "system", content: "You build apps." },
      { role: "user", content: "Use this reference." },
    ], [{ mimeType: "image/png", bytes: new Uint8Array([1, 2, 3]) }]);
    const content = messages[1]!.content;
    expect(Array.isArray(content)).toBe(true);
    if (!Array.isArray(content)) throw new Error("Expected multimodal content");
    expect(content[0]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,AQID", detail: "auto" } });
    expect(content[1]).toEqual({ type: "text", text: "Use this reference." });
  });
  it("does not alter text messages when no images are provided", () => {
    const messages = [{ role: "user" as const, content: "text" }];
    expect(attachImagesToLastUserMessage(messages, [])).toBe(messages);
  });
  it("rejects images when a user message is missing", () => {
    expect(() => attachImagesToLastUserMessage([{ role: "system", content: "system" }], [{ mimeType: "image/png", bytes: new Uint8Array() }])).toThrow("Aucun message utilisateur");
  });
});
