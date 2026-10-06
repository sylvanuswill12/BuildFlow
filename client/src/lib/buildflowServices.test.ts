import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildProjectArchive } from "./buildflowServices";
import type { Project } from "./buildflowData";

const project: Project = {
  id: "project-1234", name: "My App", type: "Web app", description: "Example", status: "En cours",
  updatedAt: "now", files: 3, accent: "#3B82F6", gradient: "blue", initials: "MA",
};

describe("full project ZIP export", () => {
  it("includes the complete source tree and a runnable fallback manifest", () => {
    const archive = unzipSync(buildProjectArchive(project, {
      "index.html": "<div id=\"root\"></div>",
      "src/App.tsx": "export default function App() { return null; }",
      "src/components/Card.tsx": "export function Card() { return null; }",
      "src/assets/logo.svg": "<svg />",
    }));
    expect(Object.keys(archive).sort()).toEqual(["buildflow-project.json", "index.html", "package.json", "README.md", "src/App.tsx", "src/assets/logo.svg", "src/components/Card.tsx"].sort());
    expect(strFromU8(archive["src/components/Card.tsx"]!)).toContain("function Card");
    expect(JSON.parse(strFromU8(archive["package.json"]!)).scripts.build).toBe("vite build");
  });
  it("does not package path traversal entries", () => {
    const archive = unzipSync(buildProjectArchive(project, { "../secrets.txt": "secret", "src/App.tsx": "ok" }));
    expect(archive["../secrets.txt"]).toBeUndefined();
  });
});
