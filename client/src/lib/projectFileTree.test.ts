import { describe, expect, it } from "vitest";
import { buildProjectFileTree } from "./projectFileTree";

describe("buildProjectFileTree", () => {
  it("builds nested folders from the current project file map", () => {
    const tree = buildProjectFileTree({
      "src/App.tsx": "app",
      "src/components/Card.tsx": "card",
      "index.html": "html",
    });
    expect(tree.map(node => node.name)).toEqual(["src", "index.html"]);
    expect(tree[0]?.children[0]).toMatchObject({ name: "components", path: "src/components", kind: "folder" });
    expect(tree[0]?.children[0]?.children[0]).toMatchObject({ name: "Card.tsx", path: "src/components/Card.tsx", kind: "file" });
    expect(tree[0]?.children[1]).toMatchObject({ name: "App.tsx", path: "src/App.tsx", kind: "file" });
  });
  it("ignores traversal paths and empty entries", () => {
    const tree = buildProjectFileTree({ "../secret.ts": "x", "src/../../secret.ts": "y", "": "empty", "safe.ts": "ok" });
    expect(tree.map(node => node.path)).toEqual(["safe.ts"]);
  });
});
