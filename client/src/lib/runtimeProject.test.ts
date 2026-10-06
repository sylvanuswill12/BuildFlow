import { describe, expect, it } from "vitest";
import { ensureRuntimeErrorBridge, prepareRuntimeFiles, runtimeTreeFromFiles, workspacePathToRuntimePath } from "./runtimeProject";

describe("generic WebContainer project files", () => {
  it("keeps generated Vite file paths intact", () => {
    expect(workspacePathToRuntimePath("src/components/TodoList.tsx")).toBe("src/components/TodoList.tsx");
    expect(workspacePathToRuntimePath("vite.config.ts")).toBe("vite.config.ts");
    expect(workspacePathToRuntimePath("src/App.tsx")).toBe("src/App.tsx");
  });
  it("maps the legacy entrypoint to src/App.tsx", () => {
    expect(workspacePathToRuntimePath("page.tsx")).toBe("src/App.tsx");
    const files = prepareRuntimeFiles("export default function App(){return <main/>}", { "page.tsx": "export default function App(){return <main/>}" });
    expect(files["src/App.tsx"]).toContain("export default");
    expect(files).not.toHaveProperty("src/components/ExpenseChart.tsx");
    expect(files["src/main.tsx"]).toContain('from "./App"');
  });
  it("adds missing Vite, TypeScript, HTML, Tailwind and package defaults", () => {
    const files = prepareRuntimeFiles("export default function App(){return <main/>}", { "src/App.tsx": "export default function App(){return <main/>}" });
    expect(files["vite.config.ts"]).toContain("@tailwindcss/vite");
    expect(JSON.parse(files["tsconfig.json"] ?? "{}").compilerOptions.jsx).toBe("react-jsx");
    expect(files["index.html"]).toContain("/src/main.tsx");
    expect(files["index.html"]).toContain("data-buildflow-error-bridge");
    expect(files["src/styles/globals.css"]).toContain('@import "tailwindcss"');
    const pkg = JSON.parse(files["package.json"] ?? "{}");
    expect(pkg.dependencies.zustand).toBeUndefined();
    expect(pkg.devDependencies.vite).toBeDefined();
    expect(pkg.scripts.build).toBe("vite build");
  });
  it("preserves generated dependencies and existing Vite configuration", () => {
    const vite = "export default { server: { port: 5180 } }";
    const files = prepareRuntimeFiles("export default function App(){return <main/>}", {
      "src/App.tsx": "export default function App(){return <main/>}",
      "vite.config.ts": vite,
      "package.json": JSON.stringify({ dependencies: { zustand: "^5.0.0" }, scripts: { test: "vitest" } }),
    });
    expect(files["vite.config.ts"]).toBe(vite);
    const pkg = JSON.parse(files["package.json"] ?? "{}");
    expect(pkg.dependencies.zustand).toBe("^5.0.0");
    expect(pkg.scripts.test).toBe("vitest");
    expect(pkg.scripts.dev).toBe("vite --host 0.0.0.0");
  });
  it("rejects paths that escape the project root and builds a directory tree", () => {
    expect(workspacePathToRuntimePath("../../secret.ts")).toBeNull();
    expect(workspacePathToRuntimePath("/etc/passwd")).toBeNull();
    const tree = runtimeTreeFromFiles({ "src/App.tsx": "app", "package.json": "{}" });
    expect((tree as any).src.directory["App.tsx"].file.contents).toBe("app");
    expect((tree as any)["package.json"].file.contents).toBe("{}");
  });
  it("forwards browser errors, rejections, and console errors exactly once", () => {
    const html = ensureRuntimeErrorBridge("<html><head></head><body></body></html>");
    expect(html).toContain("window.onerror");
    expect(html).toContain("unhandledrejection");
    expect(html).toContain("console.error");
    expect(ensureRuntimeErrorBridge(html).match(/data-buildflow-error-bridge/g)).toHaveLength(1);
  });
});
