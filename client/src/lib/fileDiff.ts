export type DiffLine = { type: "context" | "added" | "removed"; text: string };
export type ProjectFileChange = { path: string; kind: "added" | "removed" | "modified"; before?: string; after?: string };

export function diffProjectFileMaps(before: Record<string, string>, after: Record<string, string>): ProjectFileChange[] {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return paths.flatMap(path => {
    const had = Object.hasOwn(before, path);
    const has = Object.hasOwn(after, path);
    if (had && has && before[path] === after[path]) return [];
    return [{ path, kind: !had ? "added" as const : !has ? "removed" as const : "modified" as const, ...(had ? { before: before[path] } : {}), ...(has ? { after: after[path] } : {}) }];
  });
}

export function diffFileContents(before = "", after = "", maxRows = 500): DiffLine[] {
  const left = before.split("\n");
  const right = after.split("\n");
  if (left.length * right.length > 250_000) {
    return [
      { type: "removed", text: `[${left.length} lignes précédentes — fichier trop grand pour un diff détaillé]` },
      { type: "added", text: `[${right.length} lignes actuelles — fichier trop grand pour un diff détaillé]` },
    ];
  }
  const lcs = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      lcs[i]![j] = left[i] === right[j]
        ? 1 + lcs[i + 1]![j + 1]!
        : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const rows: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while ((i < left.length || j < right.length) && rows.length < maxRows) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      rows.push({ type: "context", text: left[i]! }); i += 1; j += 1;
    } else if (i < left.length && (j >= right.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      rows.push({ type: "removed", text: left[i++]! });
    } else {
      rows.push({ type: "added", text: right[j++]! });
    }
  }
  if (i < left.length || j < right.length) rows.push({ type: "context", text: "… diff tronqué …" });
  return rows;
}
