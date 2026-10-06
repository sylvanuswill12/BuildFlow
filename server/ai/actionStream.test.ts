import { describe, expect, it } from "vitest";
import { AgentActionStreamParser, buildActionGenerationResult } from "./actionStream";

describe("incremental agent action stream", () => {
  it("emits a file only after its complete closing tag arrives", () => {
    const parser = new AgentActionStreamParser();
    expect(parser.push('<file path="src/App.tsx">\nexport default function App() {')).toEqual([]);
    const actions = parser.push(" return <main>Todo</main>; }\n</file>");
    expect(actions).toEqual([{ type: "file", path: "src/App.tsx", content: "export default function App() { return <main>Todo</main>; }" }]);
    expect(parser.protocolMode).toBe("actions");
  });
  it("parses patch, shell, delete, and assistant message actions in order", () => {
    const parser = new AgentActionStreamParser();
    const actions = parser.push([
      '<patch path="src/App.tsx">{"search":"Old","replace":"New"}</patch>',
      "<shell>npm run build</shell>",
      '<delete path="src/Unused.tsx"/>',
      "<message>Build succeeded.</message>",
    ].join("\n"));
    expect(actions.map(action => action.type)).toEqual(["patch", "shell", "delete", "message"]);
    expect(actions[0]).toEqual({ type: "patch", path: "src/App.tsx", search: "Old", replace: "New" });
  });
  it("applies complete file and patch actions and reports deletions", () => {
    const parser = new AgentActionStreamParser();
    const actions = parser.push([
      '<patch path="src/App.tsx"><<<<<<< SEARCH\nOld\n=======\nNew\n>>>>>>> REPLACE</patch>',
      '<file path="src/components/Todo.tsx">export const Todo = () => null;</file>',
      '<delete path="src/remove.ts"/>',
      '<message>Ready.</message>',
    ].join("\n"));
    const result = buildActionGenerationResult(actions, {
      "src/App.tsx": "const title = 'Old';",
      "src/remove.ts": "old",
    }, "old entry");
    expect(result.files).toContainEqual({ path: "src/App.tsx", content: "const title = 'New';" });
    expect(result.files).toContainEqual({ path: "src/components/Todo.tsx", content: "export const Todo = () => null;" });
    expect(result.deletedFiles).toEqual(["src/remove.ts"]);
    expect(result.assistantMessage).toBe("Ready.");
  });
  it("leaves JSON output for the legacy parser and rejects paths outside the project", () => {
    const parser = new AgentActionStreamParser();
    expect(parser.push('{"code":"legacy"}')).toEqual([]);
    expect(parser.protocolMode).toBe("json");
    const unsafe = new AgentActionStreamParser();
    expect(() => unsafe.push('<file path="../../secret">nope</file>')).toThrow("Chemin de projet interdit");
    const entrypoint = new AgentActionStreamParser();
    const actions = entrypoint.push('<delete path="src/App.tsx"/>');
    expect(() => buildActionGenerationResult(actions, { "src/App.tsx": "entry" }, "entry")).toThrow("ne peut pas être supprimé");
  });
});
