import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createImageStorageKey, MAX_IMAGE_BYTES, readImageAttachment, removeImageAttachment, storeImageAttachment, validateImageBytes } from "./storage";

const originalStorageDir = process.env.FILE_STORAGE_DIR;
let directory = "";
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);

afterEach(async () => {
  if (originalStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = originalStorageDir;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
});

describe("private image storage", () => {
  it("stores, reads, and deletes image bytes by an opaque safe key", async () => {
    directory = await mkdtemp(join(tmpdir(), "buildflow-storage-test-"));
    process.env.FILE_STORAGE_DIR = directory;
    const key = await storeImageAttachment("image/png", png);
    expect(key).toMatch(/^[a-f0-9-]{36}\.png$/);
    expect(new Uint8Array(await readImageAttachment(key))).toEqual(png);
    await removeImageAttachment(key);
    await expect(readImageAttachment(key)).rejects.toThrow();
  });
  it("validates the actual image signature and max size", () => {
    expect(() => validateImageBytes("image/png", png)).not.toThrow();
    expect(() => validateImageBytes("image/png", new Uint8Array([1, 2, 3]))).toThrow("ne correspond pas");
    expect(() => validateImageBytes("image/svg+xml", png)).toThrow("Format image non accepté");
    expect(() => validateImageBytes("image/png", new Uint8Array(MAX_IMAGE_BYTES + 1))).toThrow("4 Mio");
  });
  it("creates an opaque key without writing to ephemeral disk", () => {
    const key = createImageStorageKey("image/png", png);
    expect(key).toMatch(/^[a-f0-9-]{36}\.png$/);
  });
  it("rejects arbitrary storage paths", async () => {
    await expect(readImageAttachment("../../etc/passwd")).rejects.toThrow("Clé de stockage invalide");
  });
});
