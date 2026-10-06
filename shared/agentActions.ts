export type AgentAction =
  | { type: "file"; path: string; content: string }
  | { type: "patch"; path: string; search: string; replace: string }
  | { type: "shell"; command: string }
  | { type: "delete"; path: string }
  | { type: "message"; content: string };

export type AgentMode = "plan" | "discussion" | "build";

export function normalizeProjectPath(path: string): string {
  const cleaned = path.trim().replace(/\\/g, "/");
  if (!cleaned || cleaned.startsWith("/") || /^[A-Za-z]:/.test(cleaned)) {
    throw new Error(`Chemin de projet interdit : ${path}`);
  }
  const parts = cleaned.split("/").filter(Boolean);
  if (!parts.length || parts.some(part => part === "." || part === "..")) {
    throw new Error(`Chemin de projet interdit : ${path}`);
  }
  const normalized = parts.join("/");
  return normalized === "page.tsx" || normalized === "App.tsx"
    ? "src/App.tsx"
    : normalized;
}

export function applyFileAgentAction(
  files: Record<string, string>,
  action: AgentAction
): { files: Record<string, string>; changedPath?: string } {
  if (action.type === "file") {
    const path = normalizeProjectPath(action.path);
    return { files: { ...files, [path]: action.content }, changedPath: path };
  }
  if (action.type === "delete") {
    const path = normalizeProjectPath(action.path);
    if (path === "src/App.tsx") throw new Error("Le point d’entrée src/App.tsx ne peut pas être supprimé.");
    const next = { ...files };
    delete next[path];
    return { files: next, changedPath: path };
  }
  if (action.type === "patch") {
    const path = normalizeProjectPath(action.path);
    const current = files[path];
    if (current === undefined) throw new Error(`Fichier introuvable pour patch : ${path}`);
    if (!action.search) throw new Error("Un patch doit contenir une chaîne de recherche non vide.");
    const index = current.indexOf(action.search);
    if (index < 0) throw new Error(`Le texte à remplacer n’a pas été trouvé dans ${path}.`);
    const nextContent = current.slice(0, index) + action.replace + current.slice(index + action.search.length);
    return { files: { ...files, [path]: nextContent }, changedPath: path };
  }
  return { files };
}
