import { applyFileAgentAction, normalizeProjectPath, type AgentAction } from "../../shared/agentActions";

export type ActionGenerationResult = {
  code: string;
  files: Array<{ path: string; content: string }>;
  deletedFiles: string[];
  changes: string[];
  assistantMessage: string;
};

function getAttribute(header: string, name: string): string | undefined {
  const match = header.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)')`, "i"));
  return match?.[1] ?? match?.[2];
}

function parsePatch(body: string): { search: string; replace: string } {
  const trimmed = body.trim();
  try {
    const parsed = JSON.parse(trimmed) as { search?: unknown; replace?: unknown };
    if (typeof parsed.search === "string" && typeof parsed.replace === "string") {
      return { search: parsed.search, replace: parsed.replace };
    }
  } catch { /* Also accept a readable SEARCH/REPLACE block. */ }
  const match = trimmed.match(/<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/);
  if (!match) throw new Error("Format de patch invalide : utilisez search/replace JSON ou SEARCH/REPLACE.");
  return { search: match[1] ?? "", replace: match[2] ?? "" };
}

function parseAction(tag: string, header: string, rawBody: string): AgentAction {
  const body = rawBody.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
  switch (tag.toLowerCase()) {
    case "file": {
      const path = getAttribute(header, "path");
      if (!path) throw new Error("L’action <file> doit fournir path.");
      return { type: "file", path: normalizeProjectPath(path), content: body };
    }
    case "patch": {
      const path = getAttribute(header, "path");
      if (!path) throw new Error("L’action <patch> doit fournir path.");
      return { type: "patch", path: normalizeProjectPath(path), ...parsePatch(body) };
    }
    case "shell":
      return { type: "shell", command: body.trim() };
    case "delete": {
      const path = getAttribute(header, "path");
      if (!path) throw new Error("L’action <delete> doit fournir path.");
      return { type: "delete", path: normalizeProjectPath(path) };
    }
    case "message":
      return { type: "message", content: body.trim() };
    default:
      throw new Error(`Action inconnue : ${tag}`);
  }
}

export class AgentActionStreamParser {
  private buffer = "";
  private mode: "unknown" | "actions" | "json" = "unknown";
  readonly actions: AgentAction[] = [];

  get protocolMode() { return this.mode; }

  push(chunk: string): AgentAction[] {
    this.buffer += chunk;
    if (this.mode === "unknown") {
      const probe = this.buffer.trimStart();
      if (/^(?:\{|\[)/.test(probe)) this.mode = "json";
      else if (/<(?:file|patch|shell|delete|message)\b/i.test(probe.slice(0, 2_000))) this.mode = "actions";
      else if (this.buffer.length > 2_000) this.mode = "json";
    }
    if (this.mode !== "actions") return [];

    const emitted: AgentAction[] = [];
    while (this.buffer.length) {
      const leading = this.buffer.match(/^\s+/)?.[0] ?? "";
      this.buffer = this.buffer.slice(leading.length);
      const selfClosingDelete = this.buffer.match(/^<delete\b([^>]*)\/>/i);
      if (selfClosingDelete) {
        const action = parseAction("delete", selfClosingDelete[1] ?? "", "");
        emitted.push(action);
        this.actions.push(action);
        this.buffer = this.buffer.slice(selfClosingDelete[0].length);
        continue;
      }
      const open = this.buffer.match(/^<([a-z]+)\b([^>]*)>/i);
      if (!open) {
        const next = this.buffer.search(/<(?:file|patch|shell|delete|message)\b/i);
        if (next < 0) {
          if (this.buffer.length > 2_000) this.buffer = this.buffer.slice(-1_000);
          break;
        }
        this.buffer = this.buffer.slice(next);
        continue;
      }
      const tag = open[1] ?? "";
      const endTag = new RegExp(`<\\/${tag}\\s*>`, "i");
      const rest = this.buffer.slice(open[0].length);
      const close = endTag.exec(rest);
      if (!close || close.index === undefined) break;
      const body = rest.slice(0, close.index);
      const action = parseAction(tag, open[2] ?? "", body);
      emitted.push(action);
      this.actions.push(action);
      this.buffer = rest.slice(close.index + close[0].length);
    }
    return emitted;
  }
}

export function buildActionGenerationResult(
  actions: AgentAction[],
  currentFiles: Record<string, string>,
  currentCode: string
): ActionGenerationResult {
  let files = { ...currentFiles };
  const touched = new Set<string>();
  let assistantMessage = "";
  for (const action of actions) {
    const result = applyFileAgentAction(files, action);
    files = result.files;
    if (result.changedPath) touched.add(result.changedPath);
    if (action.type === "message") assistantMessage = action.content;
  }
  const changedPaths = [...touched];
  const changedFiles = changedPaths
    .filter(path => path in files && currentFiles[path] !== files[path])
    .map(path => ({ path, content: files[path]! }));
  const deletedFiles = changedPaths.filter(path => path in currentFiles && !(path in files));
  const changes = changedPaths.map(path => `${path} ${path in currentFiles ? "mis à jour" : "créé"}`);
  return {
    code: files["src/App.tsx"] ?? currentCode,
    files: changedFiles,
    deletedFiles,
    changes,
    assistantMessage: assistantMessage || (changes.length ? "Les actions ont été appliquées au projet." : "Voici le résultat de la demande."),
  };
}
