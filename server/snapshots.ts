export type SnapshotFiles = Record<string, string>;
const MAX_FILES = 5_000;
const MAX_FILE_CHARS = 100_000;
const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

export function serializeSnapshotFiles(files: SnapshotFiles): string {
  const entries = Object.entries(files);
  if (entries.length > MAX_FILES) throw new Error("Le snapshot dépasse la limite de fichiers autorisée.");
  for (const [path, content] of entries) {
    const normalized = path.replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").some(part => !part || part === "." || part === "..")) {
      throw new Error(`Chemin de snapshot invalide : ${path}`);
    }
    if (content.length > MAX_FILE_CHARS) throw new Error(`Le fichier ${path} dépasse la limite de taille.`);
  }
  const serialized = JSON.stringify(files);
  if (Buffer.byteLength(serialized, "utf8") > MAX_SNAPSHOT_BYTES) throw new Error("Le snapshot dépasse 10 Mo.");
  return serialized;
}

export function parseSnapshotFiles(serialized: string): SnapshotFiles {
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Le snapshot enregistré est invalide.");
  const entries = Object.entries(value);
  if (entries.length > MAX_FILES) throw new Error("Le snapshot dépasse la limite de fichiers autorisée.");
  const files: SnapshotFiles = {};
  for (const [path, content] of entries) {
    if (typeof content !== "string") throw new Error(`Contenu de snapshot invalide : ${path}`);
    if (content.length > MAX_FILE_CHARS) throw new Error(`Le fichier ${path} dépasse la limite de taille.`);
    const normalized = path.replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").some(part => !part || part === "." || part === "..")) {
      throw new Error(`Chemin de snapshot invalide : ${path}`);
    }
    files[path] = content;
  }
  if (Buffer.byteLength(JSON.stringify(files), "utf8") > MAX_SNAPSHOT_BYTES) throw new Error("Le snapshot dépasse 10 Mo.");
  return files;
}
