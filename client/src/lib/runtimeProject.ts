import type { FileSystemTree } from "@webcontainer/api";

type ProjectFiles = Record<string, string>;
type MutableEntry = { file: { contents: string } } | { directory: MutableTree };
type MutableTree = Record<string, MutableEntry>;

const DEFAULT_VITE_CONFIG = `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nimport tailwindcss from "@tailwindcss/vite";\n\nexport default defineConfig({\n  plugins: [react(), tailwindcss()],\n  server: { host: "0.0.0.0", port: 5173 },\n});\n`;
const DEFAULT_TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    useDefineForClassFields: true,
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    module: "ESNext",
    skipLibCheck: true,
    moduleResolution: "Bundler",
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
    isolatedModules: true,
    noEmit: true,
    jsx: "react-jsx",
    strict: true,
  },
  include: ["src"],
}, null, 2) + "\n";
const DEFAULT_PACKAGE = {
  name: "buildflow-project",
  private: true,
  version: "0.0.0",
  type: "module",
  scripts: { dev: "vite --host 0.0.0.0", build: "vite build" },
  dependencies: { react: "^19.2.1", "react-dom": "^19.2.1" },
  devDependencies: {
    vite: "^7.1.9",
    "@vitejs/plugin-react": "^5.0.4",
    typescript: "^5.9.3",
    tailwindcss: "^4.1.14",
    "@tailwindcss/vite": "^4.1.14",
  },
};

function safeRelativePath(path: string): string | null {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").some(part => part === "..")) return null;
  return normalized;
}

/** Map legacy workspace labels, while leaving generated project paths intact. */
export function workspacePathToRuntimePath(path: string): string | null {
  const safe = safeRelativePath(path);
  if (!safe) return null;
  if (safe === "page.tsx" || safe === "App.tsx") return "src/App.tsx";
  if (safe === "main.tsx") return "src/main.tsx";
  if (safe.startsWith("src/") || safe.startsWith("public/")) return safe;
  if (["package.json", "index.html", "vite.config.ts", "vite.config.js", "tsconfig.json", "README.md", "tailwind.config.ts", "postcss.config.js"].includes(safe)) return safe;
  if (["globals.css", "index.css", "style.css"].includes(safe)) return "src/styles/globals.css";
  if (/^(components|lib|hooks|styles|assets)\//.test(safe)) return `src/${safe}`;
  if (/\.(tsx?|jsx?)$/.test(safe)) return `src/components/${safe}`;
  if (/\.css$/.test(safe)) return `src/styles/${safe}`;
  return safe;
}

function mergePackageManifest(raw: string | undefined): string {
  let supplied: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) supplied = parsed as Record<string, unknown>;
  } catch {
    // An invalid generated manifest is replaced by a valid, runnable Vite manifest.
  }
  const manifest = {
    ...DEFAULT_PACKAGE,
    ...supplied,
    private: true,
    type: typeof supplied.type === "string" ? supplied.type : "module",
    scripts: {
      ...DEFAULT_PACKAGE.scripts,
      ...(supplied.scripts && typeof supplied.scripts === "object" ? supplied.scripts : {}),
      dev: "vite --host 0.0.0.0",
    },
    dependencies: {
      ...DEFAULT_PACKAGE.dependencies,
      ...(supplied.dependencies && typeof supplied.dependencies === "object" ? supplied.dependencies : {}),
    },
    devDependencies: {
      ...DEFAULT_PACKAGE.devDependencies,
      ...(supplied.devDependencies && typeof supplied.devDependencies === "object" ? supplied.devDependencies : {}),
    },
  };
  return JSON.stringify(manifest, null, 2) + "\n";
}

export function ensureRuntimeErrorBridge(html: string): string {
  if (html.includes("data-buildflow-error-bridge")) return html;
  const bridge = `<script data-buildflow-error-bridge>(function(){const send=function(level,message){try{parent.postMessage({source:"buildflow-preview-runtime",type:"console",level:level,message:String(message).slice(0,4000),time:new Date().toISOString()},"*")}catch(_){}};window.onerror=function(message,source,line,column,error){send("error",(error&&error.stack)||[message,source,line,column].filter(Boolean).join(":"));return false};window.addEventListener("unhandledrejection",function(event){send("error",event.reason&&event.reason.stack||event.reason||"Unhandled promise rejection")});const original=console.error.bind(console);console.error=function(){const args=Array.from(arguments);original.apply(console,args);send("error",args.map(function(value){return value instanceof Error?value.stack||value.message:String(value)}).join(" "))}})();</script>`;
  if (/<\/head\s*>/i.test(html)) return html.replace(/<\/head\s*>/i, `${bridge}</head>`);
  return `${bridge}${html}`;
}

function treeFromFiles(files: ProjectFiles): FileSystemTree {
  const root: MutableTree = {};
  for (const [path, contents] of Object.entries(files)) {
    const segments = path.split("/").filter(Boolean);
    let cursor = root;
    segments.forEach((segment, index) => {
      if (index === segments.length - 1) {
        cursor[segment] = { file: { contents } };
        return;
      }
      const current = cursor[segment];
      if (!current || !("directory" in current)) cursor[segment] = { directory: {} };
      cursor = (cursor[segment] as { directory: MutableTree }).directory;
    });
  }
  return root as FileSystemTree;
}

export function prepareRuntimeFiles(source: string, projectFiles: ProjectFiles): ProjectFiles {
  const files: ProjectFiles = {};
  for (const [workspacePath, contents] of Object.entries(projectFiles)) {
    const runtimePath = workspacePathToRuntimePath(workspacePath);
    if (!runtimePath || runtimePath === "package.json") continue;
    files[runtimePath] = contents;
  }

  if (!files["src/App.tsx"]) files["src/App.tsx"] = source;
  if (!files["src/main.tsx"]) {
    const appPath = files["src/App.tsx"] ? "./App" : "./components/App";
    files["src/main.tsx"] = `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "${appPath}";\nimport "./styles/globals.css";\n\ncreateRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);\n`;
  }
  if (!files["index.html"]) {
    files["index.html"] = `<!doctype html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Application</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`;
  }
  if (!files["vite.config.ts"] && !files["vite.config.js"]) files["vite.config.ts"] = DEFAULT_VITE_CONFIG;
  if (!files["tsconfig.json"]) files["tsconfig.json"] = DEFAULT_TSCONFIG;
  if (!files["src/styles/globals.css"]) files["src/styles/globals.css"] = `@import "tailwindcss";\n\n:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #0f172a; background: #f8fafc; }\nbody { margin: 0; min-width: 320px; min-height: 100vh; }\n* { box-sizing: border-box; }\n`;
  files["index.html"] = ensureRuntimeErrorBridge(files["index.html"] ?? "");
  files["package.json"] = mergePackageManifest(projectFiles["package.json"]);
  return files;
}

export function runtimeTreeFromFiles(files: ProjectFiles): FileSystemTree {
  return treeFromFiles(files);
}
