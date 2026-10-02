import { describe, expect, it } from "vitest";
import { parseGeneratedChange } from "./generation";

describe("parseGeneratedChange", () => {
  it("accepts a strict structured generation", () => {
    expect(parseGeneratedChange(JSON.stringify({
      code: "export default function App() { return <main />; }",
      changes: ["Ajout de la page principale"],
      assistantMessage: "La page principale a été mise à jour.",
    }))).toEqual({
      code: "export default function App() { return <main />; }",
      changes: ["Ajout de la page principale"],
      assistantMessage: "La page principale a été mise à jour.",
    });
  });

  it("accepts a bounded multi-file patch", () => {
    expect(parseGeneratedChange(JSON.stringify({
      code: "export default function App() { return <main />; }",
      changes: ["Ajout de l’écran de connexion"],
      assistantMessage: "L’écran et le formulaire ont été ajoutés.",
      files: [
        { path: "page.tsx", content: "export default function App() { return <main />; }" },
        { path: "AuthForm.tsx", content: "export function AuthForm() { return <form />; }" },
      ],
    }))).toMatchObject({ files: [{ path: "page.tsx" }, { path: "AuthForm.tsx" }] });
  });

  it.each([
    "not-json",
    JSON.stringify({ code: "ok", changes: "not-an-array", assistantMessage: "ok" }),
    JSON.stringify({ code: "ok", changes: [42], assistantMessage: "ok" }),
    JSON.stringify({ code: "ok", changes: ["ok"], assistantMessage: "ok", extra: true }),
    JSON.stringify({ code: "ok", changes: ["ok"], assistantMessage: "ok", files: [{ path: "../secrets.env", content: "TOKEN=bad" }] }),
    JSON.stringify({ code: "ok", changes: ["ok"], assistantMessage: "ok", files: Array.from({ length: 13 }, (_, index) => ({ path: `File${index}.tsx`, content: "export default 1" })) }),
  ])("rejects malformed model output: %s", (raw) => {
    expect(parseGeneratedChange(raw)).toBeNull();
  });
});
