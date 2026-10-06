import { describe, expect, it } from "vitest";
import { getStarterTemplateFiles, STARTER_TEMPLATE_IDS } from "./starterTemplates";

describe("starter templates", () => {
  it("provides a complete Vite entry set for every template", () => {
    for (const id of STARTER_TEMPLATE_IDS) {
      const files = getStarterTemplateFiles(id);
      expect(files["src/App.tsx"]).toContain("export default function App");
      expect(files["src/styles/globals.css"]).toContain('@import "tailwindcss"');
      expect(files["index.html"]).toContain("/src/main.tsx");
      const manifest = JSON.parse(files["package.json"]);
      expect(manifest.dependencies.react).toBeDefined();
      expect(manifest.dependencies["react-dom"]).toBeDefined();
      expect(manifest.devDependencies.vite).toBeDefined();
    }
  });

  it("includes Zustand only in the Zustand starter", () => {
    const withStore = JSON.parse(getStarterTemplateFiles("react-zustand")["package.json"]);
    const withoutStore = JSON.parse(getStarterTemplateFiles("react-vite-tailwind")["package.json"]);
    expect(withStore.dependencies.zustand).toBeDefined();
    expect(withoutStore.dependencies.zustand).toBeUndefined();
  });

  it("returns an isolated file map on each call", () => {
    const first = getStarterTemplateFiles("dashboard");
    first["src/App.tsx"] = "changed";
    expect(getStarterTemplateFiles("dashboard")["src/App.tsx"]).not.toBe("changed");
  });
});
