export type PatchLineKind = "meta" | "hunk" | "add" | "delete" | "context";

export type PatchLine = {
  kind: PatchLineKind;
  text: string;
};

export function classifyPatchLines(patch: string): PatchLine[] {
  if (!patch) return [];
  return patch
    .replace(/\n$/, "")
    .split("\n")
    .map((text) => {
      if (
        text.startsWith("diff ") ||
        text.startsWith("index ") ||
        text.startsWith("--- ") ||
        text.startsWith("+++ ") ||
        text.startsWith("new file mode ") ||
        text.startsWith("deleted file mode ") ||
        text.startsWith("old mode ") ||
        text.startsWith("new mode ") ||
        text.startsWith("similarity index ") ||
        text.startsWith("rename from ") ||
        text.startsWith("rename to ") ||
        text.startsWith("Binary files ")
      ) {
        return { kind: "meta", text };
      }
      if (text.startsWith("@@")) return { kind: "hunk", text };
      if (text.startsWith("+")) return { kind: "add", text };
      if (text.startsWith("-")) return { kind: "delete", text };
      return { kind: "context", text };
    });
}
