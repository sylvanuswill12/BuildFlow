import { describe, expect, it } from "vitest";
import { buildActionStreamMessages, buildGenerationMessages, GENERATION_OUTPUT_SCHEMA, GENERATION_SYSTEM_PROMPT } from "./generationContract";

describe("shared Vite generation contract", () => {
  it("requires a React and Vite app rooted at src/App.tsx", () => {
    expect(GENERATION_SYSTEM_PROMPT).toContain("React 19 + TypeScript + Vite");
    expect(GENERATION_SYSTEM_PROMPT).toContain("src/App.tsx");
    expect(GENERATION_SYSTEM_PROMPT).toContain("Ne génère jamais de structure Next.js");
    expect(GENERATION_SYSTEM_PROMPT).toContain("page.tsx comme entrée");
  });
  it("uses a single strict schema for complete modified files", () => {
    const schema = GENERATION_OUTPUT_SCHEMA.schema as { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
    expect(schema.required).toEqual(["code", "changes", "assistantMessage", "files"]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties).toHaveProperty("files");
  });
  it("keeps the active entry and project file paths in the prompt context", () => {
    const messages = buildGenerationMessages({
      prompt: "Créer un todo app",
      currentCode: "export default function App() { return null; }",
      currentFiles: { "src/App.tsx": "app", "src/components/Todo.tsx": "export function Todo() {}", "package.json": "{}" },
      activeFile: "src/components/Todo.tsx",
      revision: 4,
    });
    expect(messages).toHaveLength(2);
    expect(messages[1]?.content).toContain("Révision actuelle : 4");
    expect(messages[1]?.content).toContain('"src/App.tsx"');
    expect(messages[1]?.content).toContain("export function Todo()");
    expect(messages[1]?.content).toContain("Mode de l’agent : build");
    expect(messages[1]?.content).toContain("Créer un todo app");
  });
  it("includes a compact summary of older turns and the latest conversation window", () => {
    const messages = buildGenerationMessages({
      prompt: "Ajoute les filtres au todo",
      conversation: Array.from({ length: 13 }, (_, index) => ({
        role: index % 2 === 0 ? "user" as const : "assistant" as const,
        content: index === 0
          ? "Le projet est une todo list personnelle."
          : index === 11
            ? "J’ai créé la liste et son formulaire."
            : `Échange ${index}`,
        ...(index === 11 ? { actions: ["src/App.tsx modifié"] } : {}),
      })),
    });
    expect(messages[1]?.content).toContain("Résumé de la conversation précédente");
    expect(messages[1]?.content).toContain("todo list personnelle");
    expect(messages.slice(2).map(message => message.content).join("\n")).toContain("J’ai créé la liste");
    expect(messages.at(-1)?.content).toContain("Ajoute les filtres au todo");
  });
  it("uses action tags for streaming while keeping the non-stream schema available", () => {
    const messages = buildActionStreamMessages({ prompt: "Crée un todo app", currentCode: "", currentFiles: {}, mode: "plan" });
    expect(messages.some(message => typeof message.content === "string" && message.content.includes("<file path="))).toBe(true);
    expect(messages.some(message => typeof message.content === "string" && message.content.includes("Mode Plan"))).toBe(true);
    expect(GENERATION_OUTPUT_SCHEMA.schema).toBeDefined();
  });
});
