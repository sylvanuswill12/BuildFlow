import { strToU8, zipSync } from "fflate";
import type { Project } from "./buildflowData";

export type MockGenerationResult = {
  code: string;
  changes: string[];
  previewRevision: number;
};

export function generateMockChange(currentCode: string, prompt: string, revision: number): MockGenerationResult {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  return {
    code: `${currentCode}\n\n// BuildFlow AI — modification générée\n// Demande : ${normalized}\nexport const generatedRevision = ${revision};`,
    changes: ["Mise à jour de l’interface", "Ajout des états interactifs", "Vérification responsive"],
    previewRevision: revision,
  };
}

export function createProjectDraft(prompt: string, type = "Application web"): Project {
  return {
    id: `project-${Date.now()}`,
    name: prompt.trim().slice(0, 32) || "Nouveau projet",
    type,
    description: prompt.trim() || "Projet généré avec BuildFlow AI.",
    status: "En cours",
    updatedAt: "à l’instant",
    files: 12,
    accent: "#3B82F6",
    gradient: "from-blue-500/30 via-violet-500/10 to-transparent",
    initials: "BF",
  };
}

export function buildProjectArchive(project: Project, sourceFiles: Record<string, string>): Uint8Array {
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "buildflow-project";
  const files: Record<string, Uint8Array> = {};
  for (const [rawPath, content] of Object.entries(sourceFiles)) {
    const path = rawPath.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!path || path.startsWith("/") || path.split("/").some(part => !part || part === "." || part === "..")) continue;
    files[path] = strToU8(content);
  }
  files["README.md"] ??= strToU8(`# ${project.name}\n\nProjet web autonome exporté depuis BuildFlow.\n\n- Type : ${project.type}\n- Statut : ${project.status}\n- Description : ${project.description}\n`);
  files["package.json"] ??= strToU8(JSON.stringify({
    name: safeName,
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: { react: "latest", "react-dom": "latest" },
    devDependencies: { vite: "latest", typescript: "latest", "@vitejs/plugin-react": "latest", tailwindcss: "latest", "@tailwindcss/vite": "latest" },
  }, null, 2));
  const { sourceFiles: _sourceFiles, ...projectMetadata } = project;
  files["buildflow-project.json"] = strToU8(JSON.stringify({ ...projectMetadata, exportedAt: new Date().toISOString() }, null, 2));
  return zipSync(files, { level: 6 });
}

export function downloadProjectZip(project: Project, files: Record<string, string>): void {
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "buildflow-project";
  const archive = buildProjectArchive(project, files);
  const archiveBuffer = new ArrayBuffer(archive.byteLength);
  new Uint8Array(archiveBuffer).set(archive);
  const blob = new Blob([archiveBuffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeName}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
