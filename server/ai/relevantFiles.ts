const MAX_FILES = 10;
const MAX_FILE_CHARS = 12_000;
const MAX_CONTEXT_CHARS = 48_000;

function tokens(value: string) {
  return [...new Set(value.toLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) ?? [])];
}

function resolveImport(activeFile: string, specifier: string, files: Record<string, string>) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return undefined;
  const bases = specifier.startsWith("@/")
    ? [`src/${specifier.slice(2)}`, specifier.slice(2)]
    : [`${activeFile.split("/").slice(0, -1).join("/")}/${specifier}`];
  for (const base of bases) {
    const parts: string[] = [];
    for (const part of base.split("/")) {
      if (part === "..") parts.pop();
      else if (part && part !== ".") parts.push(part);
    }
    const normalized = parts.join("/");
    const candidates = [normalized, ...[".tsx", ".ts", ".jsx", ".js", ".css"].map(extension => `${normalized}${extension}`), ...["tsx", "ts", "jsx", "js"].map(extension => `${normalized}/index.${extension}`)];
    const resolved = candidates.find(candidate => Object.hasOwn(files, candidate));
    if (resolved) return resolved;
  }
  return undefined;
}

export function buildImportGraph(files: Record<string, string>): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  for (const [path, content] of Object.entries(files)) {
    const imports = new Set<string>();
    for (const match of content.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)) {
      const target = resolveImport(path, match[1] ?? "", files);
      if (target) imports.add(target);
    }
    graph[path] = [...imports];
  }
  return graph;
}

export function selectRelevantFiles(
  files: Record<string, string>,
  prompt: string,
  activeFile = "src/App.tsx",
  useImportGraph = true
): Record<string, string> {
  const available = Object.entries(files);
  const terms = tokens(prompt);
  const activeContent = files[activeFile] ?? files["src/App.tsx"] ?? "";
  const graph = buildImportGraph(files);
  const directImports = new Set<string>();
  let frontier = [...(graph[activeFile] ?? [])];
  let depth = 0;
  while (frontier.length && depth < (useImportGraph ? 3 : 1)) {
    const next: string[] = [];
    for (const path of frontier) {
      if (directImports.has(path)) continue;
      directImports.add(path);
      next.push(...(graph[path] ?? []));
    }
    frontier = next;
    depth += 1;
  }
  const mentionedPaths = new Set((prompt.match(/(?:src\/)?[\w./-]+\.(?:tsx?|jsx?|css|json)/gi) ?? []).map(path => path.replace(/^\.\//, "")));
  const ranked = available.map(([path, content]) => {
    const pathLower = path.toLowerCase();
    const contentLower = content.slice(0, 24_000).toLowerCase();
    let score = 0;
    if (path === "src/App.tsx") score += 12;
    if (path === activeFile) score += 20;
    if (directImports.has(path)) score += 18;
    if (mentionedPaths.has(path)) score += 24;
    for (const term of terms) {
      if (pathLower.includes(term)) score += 5;
      if (contentLower.includes(term)) score += 1;
    }
    if (/package\.json$/.test(path) && /dependenc|install|package|build|vite|test/i.test(prompt)) score += 8;
    if (/\.css$/.test(path) && /style|color|theme|layout|responsive|design|css/i.test(prompt)) score += 8;
    return { path, content, score };
  }).sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));

  const selected: Record<string, string> = {};
  let budget = MAX_CONTEXT_CHARS;
  for (const entry of ranked) {
    if (Object.keys(selected).length >= MAX_FILES || budget <= 0) break;
    const content = entry.content.length > MAX_FILE_CHARS
      ? `${entry.content.slice(0, MAX_FILE_CHARS)}\n/* … fichier tronqué pour le contexte … */`
      : entry.content;
    if (content.length > budget) continue;
    selected[entry.path] = content;
    budget -= content.length;
  }
  return selected;
}
