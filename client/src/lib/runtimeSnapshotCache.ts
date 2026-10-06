const DATABASE_NAME = "buildflow-webcontainer-cache";
const STORE_NAME = "dependency-snapshots";
const DATABASE_VERSION = 1;
export const MAX_DEPENDENCY_SNAPSHOT_BYTES = 80 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 5;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const LOCK_FILES = ["package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", ".npmrc"];

type SnapshotRecord = { key: string; snapshot: ArrayBuffer; savedAt: number; bytes: number };

export function isSnapshotCacheable(byteLength: number) {
  return Number.isFinite(byteLength) && byteLength > 0 && byteLength <= MAX_DEPENDENCY_SNAPSHOT_BYTES;
}

export async function dependencySnapshotKey(files: Record<string, string>): Promise<string> {
  const source = LOCK_FILES.map(path => `${path}\0${files[path] ?? ""}`).join("\0");
  const data = new TextEncoder().encode(`buildflow-webcontainer-v1\0${source}`);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return `v1-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  let hash = 2166136261;
  for (const byte of data) hash = Math.imul(hash ^ byte, 16777619);
  return `v1-${(hash >>> 0).toString(16)}`;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getDependencySnapshot(key: string): Promise<Uint8Array | null> {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise(resolve => {
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const record = request.result as SnapshotRecord | undefined;
        if (!record || Date.now() - record.savedAt > MAX_AGE_MS || !isSnapshotCacheable(record.bytes)) {
          if (record) store.delete(key);
          resolve(null);
          return;
        }
        record.savedAt = Date.now();
        store.put(record);
        resolve(new Uint8Array(record.snapshot));
      };
      request.onerror = () => resolve(null);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => { database.close(); resolve(null); };
    } catch {
      database.close();
      resolve(null);
    }
  });
}

export async function putDependencySnapshot(key: string, snapshot: Uint8Array): Promise<boolean> {
  if (!isSnapshotCacheable(snapshot.byteLength)) return false;
  const database = await openDatabase();
  if (!database) return false;
  return new Promise(resolve => {
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const records = (request.result as SnapshotRecord[]).sort((a, b) => a.savedAt - b.savedAt);
        for (const stale of records.slice(0, Math.max(0, records.length - MAX_CACHE_ENTRIES + 1))) store.delete(stale.key);
        const buffer = snapshot.slice().buffer;
        store.put({ key, snapshot: buffer, savedAt: Date.now(), bytes: snapshot.byteLength } satisfies SnapshotRecord);
      };
      transaction.oncomplete = () => { database.close(); resolve(true); };
      transaction.onerror = () => { database.close(); resolve(false); };
      transaction.onabort = () => { database.close(); resolve(false); };
    } catch {
      database.close();
      resolve(false);
    }
  });
}
