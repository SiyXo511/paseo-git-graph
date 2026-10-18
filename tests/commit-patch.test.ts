import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { loadCommitPatch } from "../server/git-graph";

const directories: string[] = [];

function git(directory: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args],
    { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function repository(): string {
  const directory = mkdtempSync(join(tmpdir(), "paseo-commit-patch-"));
  directories.push(directory);
  git(directory, "init", "-b", "main");
  return directory;
}

function commit(directory: string, message: string): string {
  git(directory, "add", "-A");
  git(directory, "commit", "-m", message);
  return git(directory, "rev-parse", "HEAD").trim();
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("returns root, modification, deletion, rename, and mode-only patches", async () => {
  const directory = repository();
  writeFileSync(join(directory, "root.txt"), "one\n");
  const root = commit(directory, "root");
  const rootPatch = await loadCommitPatch(directory, root, "root.txt");
  expect(rootPatch.error).toBeNull();
  expect(rootPatch.patch).toContain("+one");

  writeFileSync(join(directory, "root.txt"), "two\n");
  const modified = commit(directory, "modify");
  const modifiedPatch = await loadCommitPatch(directory, modified, "root.txt");
  expect(modifiedPatch.patch).toContain("-one");
  expect(modifiedPatch.patch).toContain("+two");
  expect(modifiedPatch.patch).toContain("@@");

  rmSync(join(directory, "root.txt"));
  const deleted = commit(directory, "delete");
  const deletedPatch = await loadCommitPatch(directory, deleted, "root.txt");
  expect(deletedPatch.patch).toContain("-two");

  writeFileSync(join(directory, "before.txt"), "same content\n");
  commit(directory, "before rename");
  git(directory, "mv", "before.txt", "after.txt");
  const renamed = commit(directory, "rename");
  const renamedPatch = await loadCommitPatch(directory, renamed, "after.txt", "before.txt");
  expect(renamedPatch.patch).toContain("rename from before.txt");
  expect(renamedPatch.patch).toContain("rename to after.txt");

  writeFileSync(join(directory, "mode.sh"), "#!/bin/sh\n");
  commit(directory, "add mode file");
  chmodSync(join(directory, "mode.sh"), 0o755);
  const modeOnly = commit(directory, "mode only");
  const modePatch = await loadCommitPatch(directory, modeOnly, "mode.sh");
  expect(modePatch.patch).toContain("old mode");
  expect(modePatch.patch).toContain("new mode");
});

it("marks binary patches and preserves first-parent merge semantics", async () => {
  const directory = repository();
  writeFileSync(join(directory, "base.txt"), "base\n");
  commit(directory, "base");

  git(directory, "switch", "-c", "feature");
  writeFileSync(join(directory, "asset.bin"), Buffer.from([0, 1, 2, 0]));
  commit(directory, "feature binary");

  git(directory, "switch", "main");
  writeFileSync(join(directory, "main.txt"), "main\n");
  commit(directory, "main");
  git(directory, "merge", "--no-ff", "feature", "-m", "merge feature");
  const merge = git(directory, "rev-parse", "HEAD").trim();

  const binary = await loadCommitPatch(directory, merge, "asset.bin");
  expect(binary.error).toBeNull();
  expect(binary.binary).toBe(true);
  expect(binary.patch).toBe("");
});
