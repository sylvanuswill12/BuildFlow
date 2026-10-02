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

export function downloadProjectZip(project: Project, code: string): void {
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "buildflow-project";
  const readme = `# ${project.name}\n\nProjet exporté depuis BuildFlow AI.\n\n- Type : ${project.type}\n- Statut : ${project.status}\n- Description : ${project.description}\n`;
  const packageJson = JSON.stringify({ name: safeName, private: true, version: "0.1.0", scripts: { dev: "vite" }, dependencies: { react: "latest", "react-dom": "latest" } }, null, 2);
  const metadata = JSON.stringify({ ...project, exportedAt: new Date().toISOString(), source: "BuildFlow AI" }, null, 2);
  const archive = zipSync({
    "README.md": strToU8(readme),
    "package.json": strToU8(packageJson),
    "src/App.tsx": strToU8(code),
    "buildflow-project.json": strToU8(metadata),
  });
  const blob = new Blob([archive], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeName}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
