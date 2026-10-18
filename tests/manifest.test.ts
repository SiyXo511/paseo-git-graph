import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("uses the final plugin identity and registers the Git Graph workspace panel", () => {
  const manifest = JSON.parse(readFileSync("paseo-plugin.json", "utf8"));
  expect(manifest.id).toBe("paseo-git-graph");
  expect(manifest.description).toBe(
    "Read-only Git history, branch graph, file summaries, and patches for the current workspace.",
  );
  expect(manifest.requirements.paseo).toMatch(/^>=0\./);

  const clientEntry = readFileSync("index.client.tsx", "utf8");
  expect(clientEntry).toContain("addWorkspacePanel");
  expect(clientEntry).toContain('id: "git-graph"');
  expect(clientEntry).toContain('title: "Git Graph"');
});
