import { describe, expect, it } from "vitest";
import { selectRelevantFiles } from "./relevantFiles";

describe("relevant project context", () => {
  it("prioritizes the active file, entrypoint, and prompt-matching filenames", () => {
    const selected = selectRelevantFiles({
      "src/App.tsx": "export default function App(){return null}",
      "src/components/TodoFilters.tsx": "export function TodoFilters(){return null}",
      "src/components/Chart.tsx": "export function Chart(){return null}",
      "src/styles.css": ".todo{color:red}",
    }, "Ajoute un filtre de statut", "src/components/TodoFilters.tsx");
    expect(selected).toHaveProperty("src/App.tsx");
    expect(selected).toHaveProperty("src/components/TodoFilters.tsx");
  });
  it("bounds the number of files and total serialized content", () => {
    const files = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`src/file-${index}.ts`, "x".repeat(12_100)]));
    const selected = selectRelevantFiles(files, "refactor");
    expect(Object.keys(selected).length).toBeLessThanOrEqual(10);
    expect(Object.values(selected).reduce((sum, content) => sum + content.length, 0)).toBeLessThanOrEqual(48_000);
  });
  it("includes direct imports and files named in build diagnostics", () => {
    const selected = selectRelevantFiles({
      "src/App.tsx": "export default function App(){return null}",
      "src/components/TodoList.tsx": 'import TodoItem from "./TodoItem"; export default TodoList;',
      "src/components/TodoItem.tsx": "export default function TodoItem(){return null}",
      "src/lib/api.ts": "export const api = 1",
    }, "Build error in src/lib/api.ts:12", "src/components/TodoList.tsx");
    expect(selected).toHaveProperty("src/components/TodoItem.tsx");
    expect(selected).toHaveProperty("src/lib/api.ts");
  });
  it("includes transitive imported modules only while the import graph is enabled", () => {
    const files = {
      "src/App.tsx": 'import { Panel } from "@/components/Panel"; export default Panel;',
      "src/components/Panel.tsx": 'import { loadData } from "../lib/data"; export const Panel = loadData;',
      "src/lib/data.ts": "export const loadData = () => 1;",
      ...Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`src/a${String(index).padStart(2, "0")}.ts`, "export const filler = 1;"])),
    };
    expect(selectRelevantFiles(files, "update dashboard", "src/App.tsx", true)).toHaveProperty("src/lib/data.ts");
    expect(selectRelevantFiles(files, "update dashboard", "src/App.tsx", false)).not.toHaveProperty("src/lib/data.ts");
  });
});
