import { describe, expect, it } from "vitest";
import { diffFileContents, diffProjectFileMaps } from "./fileDiff";

describe("project file diffs", () => {
  it("classifies added, removed, and modified files", () => {
    expect(diffProjectFileMaps({ "keep.ts": "same", "old.ts": "old", "edit.ts": "before" }, { "keep.ts": "same", "new.ts": "new", "edit.ts": "after" })).toEqual([
      { path: "edit.ts", kind: "modified", before: "before", after: "after" },
      { path: "new.ts", kind: "added", after: "new" },
      { path: "old.ts", kind: "removed", before: "old" },
    ]);
  });
  it("renders line additions and removals", () => {
    const rows = diffFileContents("one\nold\nthree", "one\nnew\nthree");
    expect(rows).toEqual([
      { type: "context", text: "one" },
      { type: "removed", text: "old" },
      { type: "added", text: "new" },
      { type: "context", text: "three" },
    ]);
  });
});
