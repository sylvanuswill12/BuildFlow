import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { MAX_IMAGE_ATTACHMENT_BYTES } from "../shared/attachments";

export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];
export const MAX_IMAGE_BYTES = MAX_IMAGE_ATTACHMENT_BYTES;
export const MAX_IMAGE_BASE64_CHARS = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;
const extensionFor: Record<ImageMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function storageRoot() {
  return resolve(process.env.FILE_STORAGE_DIR?.trim() || join(process.cwd(), "var", "uploads"));
}

export function validateImageBytes(mimeType: string, bytes: Uint8Array): asserts mimeType is ImageMimeType {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) throw new Error("Format image non accepté. Utilisez PNG, JPEG, WebP ou GIF.");
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Une image doit peser au maximum 4 Mio.");
  const signatureMatches = mimeType === "image/png"
    ? bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
    : mimeType === "image/jpeg"
      ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mimeType === "image/webp"
        ? bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
        : bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.subarray(0, 6)));
  if (!signatureMatches) throw new Error("Le contenu du fichier ne correspond pas au format image déclaré.");
}

function safeStorageKey(key: string) {
  if (!/^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(key)) throw new Error("Clé de stockage invalide.");
  return join(storageRoot(), key);
}

export function createImageStorageKey(mimeType: ImageMimeType, bytes: Uint8Array) {
  validateImageBytes(mimeType, bytes);
  return `${randomUUID()}.${extensionFor[mimeType]}`;
}

export async function storeImageAttachment(mimeType: ImageMimeType, bytes: Uint8Array) {
  const storageKey = createImageStorageKey(mimeType, bytes);
  await mkdir(storageRoot(), { recursive: true, mode: 0o700 });
  await writeFile(safeStorageKey(storageKey), bytes, { flag: "wx", mode: 0o600 });
  return storageKey;
}

export async function readImageAttachment(storageKey: string): Promise<Buffer> {
  return readFile(safeStorageKey(storageKey));
}

export async function removeImageAttachment(storageKey: string) {
  await rm(safeStorageKey(storageKey), { force: true });
}
