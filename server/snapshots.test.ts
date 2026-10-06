import { describe, expect, it } from "vitest";
import { parseSnapshotFiles, serializeSnapshotFiles } from "./snapshots";

describe("project snapshots", () => {
  it("round-trips a complete project file map", () => {
    const files = { "src/App.tsx": "export default function App() { return null; }", "src/style.css": ".app { color: red; }" };
    expect(parseSnapshotFiles(serializeSnapshotFiles(files))).toEqual(files);
  });
  it("rejects traversal and absolute paths", () => {
    expect(() => serializeSnapshotFiles({ "../secrets.env": "x" })).toThrow("Chemin de snapshot invalide");
    expect(() => parseSnapshotFiles('{"/etc/passwd":"x"}')).toThrow("Chemin de snapshot invalide");
  });
  it("rejects oversized file maps and malformed stored snapshots", () => {
    expect(() => serializeSnapshotFiles({ "large.txt": "x".repeat(100_001) })).toThrow("dépasse la limite de taille");
    expect(() => parseSnapshotFiles("[]")).toThrow("snapshot enregistré est invalide");
  });
});
