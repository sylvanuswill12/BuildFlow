import {
  WebContainer,
  type FileSystemTree,
  type WebContainerProcess,
} from "@webcontainer/api";

type ProjectFiles = Record<string, string>;
type MutableEntry = { file: { contents: string } } | { directory: MutableTree };
type MutableTree = Record<string, MutableEntry>;

let containerPromise: Promise<WebContainer> | null = null;
let installPromise: Promise<void> | null = null;
let mountChain: Promise<unknown> = Promise.resolve();
let previewUrl: string | null = null;
let devProcess: WebContainerProcess | null = null;
let latestSource = "";
let latestFiles: ProjectFiles = {};
let sourceVersion = 0;
let mountedVersion = 0;
export type RuntimeLogger = (message: string) => void;

function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error(message)),
      milliseconds
    );
    promise
      .then(value => {
        window.clearTimeout(timeout);
        resolve(value);
      })
      .catch(error => {
        window.clearTimeout(timeout);
        reject(error);
      });
  });
}

function normalizeSource(source: string) {
  if (!/\bexport\s+default\b/.test(source)) {
    throw new Error(
      "Le runtime beta attend un composant avec un export default dans le fichier actif."
    );
  }
  return source
    .replaceAll('from "@/components/', 'from "./components/')
    .replaceAll("from '@/components/", "from './components/")
    .replaceAll('from "@/', 'from "./')
    .replaceAll("from '@/", "from './");
}

function packageForProject(projectFiles: ProjectFiles) {
  let projectPackage: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(projectFiles["package.json"] ?? "{}");
    if (parsed && typeof parsed === "object") projectPackage = parsed;
  } catch {
    // Keep the safe runtime manifest when a generated package.json is incomplete.
  }
  const dependencies =
    projectPackage.dependencies &&
    typeof projectPackage.dependencies === "object"
      ? projectPackage.dependencies
      : {};
  const devDependencies =
    projectPackage.devDependencies &&
    typeof projectPackage.devDependencies === "object"
      ? projectPackage.devDependencies
      : {};
  return {
    ...projectPackage,
    name:
      typeof projectPackage.name === "string"
        ? projectPackage.name
        : "buildflow-runtime",
    private: true,
    scripts: {
      ...(typeof projectPackage.scripts === "object" && projectPackage.scripts
        ? projectPackage.scripts
        : {}),
      dev: "vite --host 0.0.0.0",
    },
    dependencies: { ...dependencies, react: "^19.2.1", "react-dom": "^19.2.1" },
    devDependencies: {
      ...devDependencies,
      vite: "^7.1.9",
      "@vitejs/plugin-react": "^5.0.4",
      typescript: "^5.9.3",
    },
  };
}

function filePathForWorkspaceKey(key: string) {
  if (key.startsWith("src/") || key.startsWith("public/")) return key;
  if (key === "layout.tsx") return "src/app/layout.tsx";
  if (key === "utils.ts") return "src/lib/utils.ts";
  if (key === "globals.css") return "src/styles/globals.css";
  if (
    [
      "Sidebar.tsx",
      "DashboardCard.tsx",
      "ExpenseChart.tsx",
      "ExpenseForm.tsx",
      "TransactionList.tsx",
    ].includes(key)
  )
    return `src/components/${key}`;
  if (key === "README.md") return "README.md";
  if (key === "tailwind.config.ts") return "tailwind.config.ts";
  if (key === "package.json") return "package.json";
  return `src/generated/${key.replace(/^\/+/, "")}`;
}

function treeFromFiles(files: Record<string, string>): FileSystemTree {
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
      if (!current || !("directory" in current))
        cursor[segment] = { directory: {} };
      cursor = (cursor[segment] as { directory: MutableTree }).directory;
    });
  }
  return root as FileSystemTree;
}

function filesForProject(
  source: string,
  projectFiles: ProjectFiles
): FileSystemTree {
  const dashboardCard =
    projectFiles["DashboardCard.tsx"] ??
    `export function DashboardCard({ label, value }: { label: string; value: string }) { return <article style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, background: "white" }}><span style={{ color: "#64748b", fontSize: 12 }}>{label}</span><strong style={{ display: "block", marginTop: 8, fontSize: 24 }}>{value}</strong></article>; }`;
  const expenseChart =
    projectFiles["ExpenseChart.tsx"] ??
    `export function ExpenseChart() { return <section style={{ marginTop: 24, border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, background: "white" }}><h2 style={{ fontSize: 16 }}>Dépenses mensuelles</h2><div style={{ display: "flex", alignItems: "end", gap: 8, height: 160, marginTop: 20 }}>{[42,58,48,75,62,84,73,91,68,78].map((height, index) => <i key={index} style={{ display: "block", flex: 1, height: height + "%", background: "#3b82f6", borderRadius: "6px 6px 2px 2px" }} />)}</div></section>; }`;
  const files: Record<string, string> = {
    "package.json": JSON.stringify(packageForProject(projectFiles), null, 2),
    "index.html": `<!doctype html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BuildFlow Runtime</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
    "src/main.tsx": `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\nimport "./styles/globals.css";\ncreateRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);`,
    "src/App.tsx": normalizeSource(source),
    "src/components/DashboardCard.tsx": dashboardCard,
    "src/components/ExpenseChart.tsx": expenseChart,
    "src/styles/globals.css":
      projectFiles["globals.css"] ??
      "body{margin:0;background:#f8fafc;color:#0f172a;font-family:system-ui,sans-serif}*{box-sizing:border-box}",
  };
  for (const [key, contents] of Object.entries(projectFiles)) {
    if (
      key === "page.tsx" ||
      key === "package.json" ||
      key === "DashboardCard.tsx" ||
      key === "ExpenseChart.tsx" ||
      key === "globals.css"
    )
      continue;
    files[filePathForWorkspaceKey(key)] = contents;
  }
  return treeFromFiles(files);
}

function resetFailedBoot() {
  containerPromise = null;
  installPromise = null;
  previewUrl = null;
  devProcess = null;
  mountedVersion = 0;
}

async function getContainer() {
  if (!containerPromise) {
    containerPromise = withTimeout(
      WebContainer.boot({ coep: "credentialless" }),
      15_000,
      "WebContainer n’a pas pu s’initialiser dans ce navigateur (timeout de 15 s)."
    ).catch(error => {
      containerPromise = null;
      throw error;
    });
  }
  return containerPromise;
}

function enqueueMount(source: string, projectFiles: ProjectFiles) {
  latestSource = source;
  latestFiles = projectFiles;
  const version = ++sourceVersion;
  const task = mountChain
    .catch(() => undefined)
    .then(async () => {
      const container = await getContainer();
      await container.mount(filesForProject(source, projectFiles));
      mountedVersion = version;
      return container;
    });
  mountChain = task;
  return task;
}

async function ensureLatestSourceMounted() {
  while (mountedVersion !== sourceVersion) {
    await enqueueMount(latestSource, latestFiles);
  }
}

async function ensureDependencies(
  container: WebContainer,
  log?: RuntimeLogger
) {
  if (!installPromise) {
    log?.("Installation des dépendances…");
    installPromise = container
      .spawn("npm", ["install"])
      .then(async process => {
        process.output
          .pipeTo(
            new WritableStream({ write: message => log?.(String(message)) })
          )
          .catch(() => undefined);
        const exitCode = await process.exit;
        if (exitCode !== 0)
          throw new Error(
            `Installation du runtime échouée (code ${exitCode}).`
          );
        log?.("Dépendances installées.");
      })
      .catch(error => {
        installPromise = null;
        throw error;
      });
  }
  await installPromise;
}

async function startDevServer(container: WebContainer, log?: RuntimeLogger) {
  if (previewUrl) return previewUrl;
  const ready = new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Le serveur Vite n’a pas démarré à temps."));
    }, 30_000);
    const unsubscribe = container.on("server-ready", (_port, url) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(url);
    });
    log?.("Démarrage du serveur Vite…");
    container
      .spawn("npm", ["run", "dev"])
      .then(process => {
        if (settled) {
          process.kill();
          return;
        }
        devProcess = process;
        process.output
          .pipeTo(
            new WritableStream({ write: message => log?.(String(message)) })
          )
          .catch(() => undefined);
        void process.exit.then(exitCode => {
          if (!settled && exitCode !== 0) {
            settled = true;
            window.clearTimeout(timeout);
            unsubscribe();
            reject(
              new Error(`Le serveur Vite s’est arrêté (code ${exitCode}).`)
            );
          }
        });
      })
      .catch(error => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        unsubscribe();
        reject(error);
      });
  });
  try {
    previewUrl = await ready;
    log?.(`Serveur prêt : ${previewUrl}`);
    return previewUrl;
  } catch (error) {
    if (devProcess) {
      devProcess.kill();
      devProcess = null;
    }
    previewUrl = null;
    throw error;
  }
}

export async function startWebContainerRuntime(
  source: string,
  projectFiles: ProjectFiles,
  log?: RuntimeLogger
): Promise<string> {
  try {
    const container = await enqueueMount(source, projectFiles);
    log?.("Initialisation du sandbox navigateur…");
    await ensureDependencies(container, log);
    await ensureLatestSourceMounted();
    return await startDevServer(container, log);
  } catch (error) {
    resetFailedBoot();
    throw error;
  }
}

export async function updateWebContainerRuntime(
  source: string,
  projectFiles: ProjectFiles
) {
  if (!containerPromise) return;
  await enqueueMount(source, projectFiles);
  await ensureLatestSourceMounted();
}
