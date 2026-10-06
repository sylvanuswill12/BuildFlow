import {
  WebContainer,
  type WebContainerProcess,
} from "@webcontainer/api";
import {
  prepareRuntimeFiles,
  runtimeTreeFromFiles,
} from "@/lib/runtimeProject";
import { isFeatureEnabled } from "@/lib/featureSettings";
import { dependencySnapshotKey, getDependencySnapshot, putDependencySnapshot } from "@/lib/runtimeSnapshotCache";

type ProjectFiles = Record<string, string>;
let containerPromise: Promise<WebContainer> | null = null;
let installPromise: { signature: string; promise: Promise<void> } | null = null;
let installChain: Promise<void> = Promise.resolve();
let syncChain: Promise<unknown> = Promise.resolve();
let previewUrl: string | null = null;
let devProcess: WebContainerProcess | null = null;
let latestSource = "";
let latestFiles: ProjectFiles = {};
let mountedFiles: ProjectFiles | null = null;
let sourceVersion = 0;
let mountedVersion = 0;
let installedPackageSignature: string | null = null;
export type RuntimeLogger = (message: string) => void;

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(value => {
      window.clearTimeout(timeout);
      resolve(value);
    }).catch(error => {
      window.clearTimeout(timeout);
      reject(error);
    });
  });
}

async function getContainer() {
  if (!window.crossOriginIsolated) {
    throw new Error("Le runtime réel nécessite l’isolation cross-origin. Redéployez l’application puis rechargez la page en autorisant les workers et les cookies de site.");
  }
  if (!containerPromise) {
    containerPromise = withTimeout(
      WebContainer.boot({ coep: "credentialless" }),
      45_000,
      "WebContainer n’a pas pu s’initialiser dans ce navigateur (timeout de 45 s). Vérifiez que le navigateur autorise les workers et les cookies de site."
    ).catch(error => {
      containerPromise = null;
      throw error;
    });
  }
  return containerPromise;
}

export async function prewarmWebContainerRuntime(log?: RuntimeLogger) {
  if (!isFeatureEnabled("prewarmRuntime")) return false;
  const startedAt = performance.now();
  try {
    await getContainer();
    log?.(`WebContainer préchauffé en ${Math.round(performance.now() - startedAt)} ms.`);
    return true;
  } catch (error) {
    log?.(`Préchauffage indisponible : ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function writeChangedFiles(container: WebContainer, files: ProjectFiles) {
  if (!mountedFiles) {
    await container.mount(runtimeTreeFromFiles(files));
    mountedFiles = { ...files };
    return;
  }
  const previous = mountedFiles;
  const removed = Object.keys(previous).filter(path => !(path in files));
  const changed = Object.entries(files).filter(([path, contents]) => previous[path] !== contents);
  for (const path of removed) {
    try {
      await container.fs.rm(path);
    } catch {
      // The file may already have been removed by a generated shell action.
    }
  }
  for (const [path, contents] of changed) {
    await container.fs.writeFile(path, contents);
  }
  mountedFiles = { ...files };
}

function enqueueSync(source: string, projectFiles: ProjectFiles) {
  latestSource = source;
  latestFiles = projectFiles;
  const version = ++sourceVersion;
  const files = prepareRuntimeFiles(source, projectFiles);
  const task = syncChain.catch(() => undefined).then(async () => {
    const container = await getContainer();
    await writeChangedFiles(container, files);
    mountedVersion = version;
    return container;
  });
  syncChain = task;
  return task;
}

async function ensureLatestFilesSynced() {
  while (mountedVersion !== sourceVersion) await enqueueSync(latestSource, latestFiles);
}

async function packageSignature(files: ProjectFiles) {
  return dependencySnapshotKey(files);
}

async function runInstall(container: WebContainer, log?: RuntimeLogger) {
  log?.("Installation/mise à jour des dépendances npm…");
  const process = await container.spawn("npm", ["install", "--no-audit", "--no-fund"]);
  const outputTask = process.output.pipeTo(new WritableStream({ write: message => log?.(String(message)) })).catch(() => undefined);
  const exitCode = await process.exit;
  await outputTask;
  if (exitCode !== 0) throw new Error(`Installation du runtime échouée (code ${exitCode}).`);
  log?.("Dépendances installées.");
}

async function ensureDependencies(container: WebContainer, log?: RuntimeLogger) {
  while (true) {
    const packageText = mountedFiles?.["package.json"] ?? "";
    const signature = await packageSignature(mountedFiles ?? {});
    if (signature === installedPackageSignature) return;
    if (installPromise?.signature === signature) {
      await installPromise.promise;
      continue;
    }
    const promise = installChain.catch(() => undefined).then(async () => {
      if (isFeatureEnabled("dependencySnapshotCache")) {
        const cached = await getDependencySnapshot(signature);
        if (cached) {
          try {
            await container.mount(cached, { mountPoint: "node_modules" });
            installedPackageSignature = signature;
            log?.("Dépendances restaurées depuis le cache local du navigateur.");
            return;
          } catch (error) {
            log?.(`Cache de dépendances ignoré : ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      await runInstall(container, log);
      if (isFeatureEnabled("dependencySnapshotCache")) {
        try {
          const snapshot = await container.export("node_modules", { format: "binary" });
          if (await putDependencySnapshot(signature, snapshot)) log?.("Snapshot des dépendances enregistré dans IndexedDB.");
        } catch (error) {
          log?.(`Cache non enregistré : ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });
    installChain = promise;
    installPromise = { signature, promise };
    try {
      await promise;
      installedPackageSignature = signature;
    } catch (error) {
      if (installPromise?.promise === promise) installPromise = null;
      throw error;
    }
    if (packageText === (mountedFiles?.["package.json"] ?? "") && signature === await packageSignature(mountedFiles ?? {})) return;
  }
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
    container.spawn("npm", ["run", "dev"]).then(process => {
      if (settled) {
        process.kill();
        return;
      }
      devProcess = process;
      process.output.pipeTo(new WritableStream({ write: message => log?.(String(message)) })).catch(() => undefined);
      void process.exit.then(exitCode => {
        if (!settled && exitCode !== 0) {
          settled = true;
          window.clearTimeout(timeout);
          unsubscribe();
          reject(new Error(`Le serveur Vite s’est arrêté (code ${exitCode}).`));
        }
      });
    }).catch(error => {
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
    devProcess?.kill();
    devProcess = null;
    previewUrl = null;
    throw error;
  }
}

export async function startWebContainerRuntime(source: string, projectFiles: ProjectFiles, log?: RuntimeLogger) {
  const startedAt = performance.now();
  try {
    const container = await enqueueSync(source, projectFiles);
    log?.("Initialisation du sandbox navigateur…");
    await ensureDependencies(container, log);
    await ensureLatestFilesSynced();
    const url = await startDevServer(container, log);
    log?.(`Runtime prêt en ${Math.round(performance.now() - startedAt)} ms.`);
    return url;
  } catch (error) {
    containerPromise = null;
    previewUrl = null;
    devProcess = null;
    mountedFiles = null;
    mountedVersion = 0;
    installedPackageSignature = null;
    installPromise = null;
    throw error;
  }
}

export async function updateWebContainerRuntime(source: string, projectFiles: ProjectFiles, log?: RuntimeLogger) {
  if (!containerPromise) return;
  await enqueueSync(source, projectFiles);
  await ensureLatestFilesSynced();
  const container = await getContainer();
  await ensureDependencies(container, log);
}

export async function runWebContainerCommand(
  command: string,
  log?: RuntimeLogger,
  timeoutMs = 120_000
): Promise<{ exitCode: number; output: string }> {
  if (!command.trim()) throw new Error("Commande shell vide.");
  const container = await getContainer();
  await ensureLatestFilesSynced();
  await ensureDependencies(container, log);
  log?.(`$ ${command}`);
  const process = await container.spawn("jsh", ["-c", command]);
  const chunks: string[] = [];
  const outputTask = process.output.pipeTo(new WritableStream({
    write(message) {
      const text = String(message);
      chunks.push(text);
      if (chunks.join("").length > 40_000) chunks.shift();
      log?.(text);
    },
  })).catch(() => undefined);
  let timeoutHandle = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = window.setTimeout(() => {
      process.kill();
      reject(new Error(`Commande interrompue après ${Math.round(timeoutMs / 1000)} secondes.`));
    }, timeoutMs);
  });
  try {
    const exitCode = await Promise.race([process.exit, timeout]);
    await outputTask;
    return { exitCode, output: chunks.join("").slice(-40_000) };
  } finally {
    window.clearTimeout(timeoutHandle);
    process.kill();
  }
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function exportWebContainerBuildFiles(directory = "dist"): Promise<Record<string, string>> {
  const container = await getContainer();
  const files: Record<string, string> = {};
  let totalBytes = 0;
  const visit = async (current: string): Promise<void> => {
    const entries = await container.fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const path = `${current}/${entry.name}`;
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        const bytes = await container.fs.readFile(path);
        totalBytes += bytes.byteLength;
        if (Object.keys(files).length >= 20_000 || totalBytes > 100 * 1024 * 1024) {
          throw new Error("Le build dépasse les limites de publication (20 000 fichiers / 100 Mo).");
        }
        files[path.slice(directory.length + 1)] = encodeBase64(bytes);
      }
    }
  };
  await visit(directory);
  if (!Object.hasOwn(files, "index.html")) throw new Error("Le build ne contient pas dist/index.html. Vérifiez le script build du projet.");
  return files;
}

export function stopWebContainerRuntime() {
  devProcess?.kill();
  devProcess = null;
  previewUrl = null;
  containerPromise = null;
  mountedFiles = null;
  mountedVersion = 0;
  installedPackageSignature = null;
  installPromise = null;
}
