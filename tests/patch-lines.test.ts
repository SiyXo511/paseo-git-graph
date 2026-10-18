import { expect, it } from "vitest";
import { classifyPatchLines } from "../client/patch-lines";

it("classifies metadata, hunks, additions, deletions, and context", () => {
  const lines = classifyPatchLines(
    [
      "diff --git a/a.txt b/a.txt",
      "index 111..222 100644",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,2 +1,2 @@",
      " unchanged",
      "-old",
      "+new",
    ].join("\n"),
  );

  expect(lines.map((line) => line.kind)).toEqual([
    "meta",
    "meta",
    "meta",
    "meta",
    "hunk",
    "context",
    "delete",
    "add",
  ]);
});
