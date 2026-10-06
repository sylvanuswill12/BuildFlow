import { describe, expect, it } from "vitest";
import { dependencySnapshotKey, isSnapshotCacheable, MAX_DEPENDENCY_SNAPSHOT_BYTES } from "./runtimeSnapshotCache";

describe("WebContainer dependency snapshot cache", () => {
  it("creates a stable cache key from dependency manifests and lock files", async () => {
    const first = await dependencySnapshotKey({ "package.json": "{\"dependencies\":{\"react\":\"19\"}}", "src/App.tsx": "one" });
    const same = await dependencySnapshotKey({ "src/App.tsx": "two", "package.json": "{\"dependencies\":{\"react\":\"19\"}}" });
    const changed = await dependencySnapshotKey({ "package.json": "{\"dependencies\":{\"react\":\"20\"}}" });
    expect(first).toBe(same);
    expect(first).not.toBe(changed);
  });
  it("rejects empty, invalid, and quota-sized snapshots", () => {
    expect(isSnapshotCacheable(1)).toBe(true);
    expect(isSnapshotCacheable(0)).toBe(false);
    expect(isSnapshotCacheable(Number.NaN)).toBe(false);
    expect(isSnapshotCacheable(MAX_DEPENDENCY_SNAPSHOT_BYTES + 1)).toBe(false);
  });
});
