import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { zipSync, strToU8 } from "fflate";

const execFileAsync = promisify(execFile);

export type DeploymentTarget = "vercel" | "netlify" | "cloudflare";
export type DeploymentStatus = "queued" | "building" | "ready" | "error";

export type DeploymentResult = {
  target: DeploymentTarget;
  status: DeploymentStatus;
  deploymentId?: string;
  url?: string;
  message: string;
};

export type DeploymentFiles = Record<string, string>;

const env = (name: string) => process.env[name]?.trim() || "";

const requiredEnv: Record<DeploymentTarget, string[]> = {
  vercel: ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"],
  netlify: ["NETLIFY_AUTH_TOKEN", "NETLIFY_SITE_ID"],
  cloudflare: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_PROJECT_NAME"],
};

export function deploymentPreflight(target: DeploymentTarget) {
  const missing = requiredEnv[target].filter(name => !env(name));
  return {
    target,
    ready: missing.length === 0,
    missing,
    message: missing.length === 0
      ? `Configuration ${target} prête pour un déploiement.`
      : `Configuration ${target} incomplète : ${missing.join(", ")}.`,
  };
}

function normalizeFiles(files: DeploymentFiles): Array<{ path: string; bytes: Uint8Array }> {
  const entries = Object.entries(files)
    .map(([path, content]) => [path.replace(/^\.\//, "").replace(/^dist\//, ""), content] as const)
    .filter(([path]) => path && !path.endsWith("/") && !path.split("/").includes(".."));
  if (entries.length === 0) throw new Error("Le bundle de déploiement est vide.");
  if (entries.length > 20_000) throw new Error("Le bundle dépasse la limite de 20 000 fichiers.");
  const normalized = entries.map(([path, content]) => ({ path, bytes: strToU8(content) }));
  const hasIndex = normalized.some(file => file.path === "index.html");
  if (!hasIndex) {
    throw new Error("Aucun index.html buildé n’est disponible. Construisez d’abord un bundle statique avant de publier.");
  }
  const totalBytes = normalized.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  if (totalBytes > 100 * 1024 * 1024) throw new Error("Le bundle dépasse 100 Mo.");
  return normalized;
}

function zipBundle(files: Array<{ path: string; bytes: Uint8Array }>) {
  const archive = zipSync(Object.fromEntries(files.map(file => [file.path, file.bytes])), { level: 6 });
  return Buffer.from(archive);
}

async function responseError(response: Response, prefix: string) {
  const detail = (await response.text()).slice(0, 800);
  throw new Error(`${prefix} (${response.status})${detail ? ` : ${detail}` : ""}`);
}

async function deployNetlify(files: Array<{ path: string; bytes: Uint8Array }>): Promise<DeploymentResult> {
  const token = env("NETLIFY_AUTH_TOKEN");
  const siteId = env("NETLIFY_SITE_ID");
  const response = await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/deploys`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/zip" },
    body: zipBundle(files),
  });
  if (!response.ok) await responseError(response, "Netlify a refusé le déploiement");
  const initial = (await response.json()) as { id?: string; state?: string; ssl_url?: string; url?: string };
  if (!initial.id) throw new Error("Netlify n’a pas retourné d’identifiant de déploiement.");
  const final = await pollNetlify(initial.id, token);
  const ready = final.state === "ready";
  return {
    target: "netlify",
    status: ready ? "ready" : "error",
    deploymentId: initial.id,
    url: final.ssl_url || final.url || initial.ssl_url || initial.url,
    message: ready ? "Déploiement Netlify prêt." : `Netlify a terminé avec l’état ${final.state ?? "inconnu"}.`,
  };
}

async function pollNetlify(id: string, token: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await fetch(`https://api.netlify.com/api/v1/deploys/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) await responseError(response, "Impossible de suivre le déploiement Netlify");
    const data = (await response.json()) as { state?: string; ssl_url?: string; url?: string };
    if (["ready", "error", "failed"].includes(data.state ?? "")) return data;
    await new Promise(resolve => setTimeout(resolve, 1_500));
  }
  throw new Error("Netlify n’a pas terminé dans le délai de suivi autorisé.");
}

async function deployVercel(files: Array<{ path: string; bytes: Uint8Array }>): Promise<DeploymentResult> {
  const token = env("VERCEL_TOKEN");
  const project = env("VERCEL_PROJECT_ID");
  const team = env("VERCEL_TEAM_ID");
  const references: Array<{ file: string; sha: string; size: number }> = [];
  for (const file of files) {
    const sha = createHash("sha1").update(file.bytes).digest("hex");
    const upload = await fetch("https://api.vercel.com/v2/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(file.bytes.byteLength),
        "x-vercel-digest": sha,
      },
      body: Buffer.from(file.bytes),
    });
    if (!upload.ok && upload.status !== 409) await responseError(upload, "Vercel a refusé l’upload d’un fichier");
    references.push({ file: `/${file.path}`, sha, size: file.bytes.byteLength });
  }
  const query = team ? `?teamId=${encodeURIComponent(team)}&forceNew=1` : "?forceNew=1";
  const created = await fetch(`https://api.vercel.com/v13/deployments${query}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: project, project, target: "production", files: references }),
  });
  if (!created.ok) await responseError(created, "Vercel a refusé la création du déploiement");
  const initial = (await created.json()) as { id?: string; url?: string; readyState?: string; state?: string };
  if (!initial.id) throw new Error("Vercel n’a pas retourné d’identifiant de déploiement.");
  const final = await pollVercel(initial.id, token, team);
  const state = final.readyState || final.state;
  const ready = state === "READY";
  return {
    target: "vercel",
    status: ready ? "ready" : "error",
    deploymentId: initial.id,
    url: final.url ? `https://${final.url}` : initial.url ? `https://${initial.url}` : undefined,
    message: ready ? "Déploiement Vercel prêt." : `Vercel a terminé avec l’état ${state ?? "inconnu"}.`,
  };
}

async function pollVercel(id: string, token: string, team?: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const suffix = team ? `?teamId=${encodeURIComponent(team)}` : "";
    const response = await fetch(`https://api.vercel.com/v13/deployments/${encodeURIComponent(id)}${suffix}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) await responseError(response, "Impossible de suivre le déploiement Vercel");
    const data = (await response.json()) as { readyState?: string; state?: string; url?: string };
    if (["READY", "ERROR", "CANCELED", "BLOCKED"].includes(data.readyState ?? data.state ?? "")) return data;
    await new Promise(resolve => setTimeout(resolve, 1_500));
  }
  throw new Error("Vercel n’a pas terminé dans le délai de suivi autorisé.");
}

async function deployCloudflare(files: Array<{ path: string; bytes: Uint8Array }>): Promise<DeploymentResult> {
  const bin = env("CLOUDFLARE_WRANGLER_BIN") || "wrangler";
  const directory = await mkdtemp(join(tmpdir(), "buildflow-pages-"));
  try {
    for (const file of files) {
      const target = join(directory, ...file.path.split("/"));
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, file.bytes, { flag: "w" });
    }
    const args = ["pages", "deploy", directory, "--project-name", env("CLOUDFLARE_PROJECT_NAME")];
    const result = await execFileAsync(bin, args, {
      env: { ...process.env, CLOUDFLARE_API_TOKEN: env("CLOUDFLARE_API_TOKEN"), CLOUDFLARE_ACCOUNT_ID: env("CLOUDFLARE_ACCOUNT_ID") },
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const url = result.stdout.match(/https?:\/\/[^\s]+/)?.[0];
    return { target: "cloudflare", status: "ready", url, message: "Déploiement Cloudflare Pages prêt via Wrangler." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erreur Wrangler inconnue.";
    throw new Error(`Cloudflare Pages a échoué : ${detail}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function deployFiles(target: DeploymentTarget, sourceFiles: DeploymentFiles): Promise<DeploymentResult> {
  const files = normalizeFiles(sourceFiles);
  if (target === "netlify") return deployNetlify(files);
  if (target === "vercel") return deployVercel(files);
  return deployCloudflare(files);
}
