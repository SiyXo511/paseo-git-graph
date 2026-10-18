import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { loadCommitFiles } from "../server/git-graph";

const directories: string[] = [];

function git(directory: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args],
    { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function repository(): string {
  const directory = mkdtempSync(join(tmpdir(), "paseo-commit-files-"));
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

it("reports root, modified, added, deleted, renamed, and binary files", async () => {
  const directory = repository();
  writeFileSync(join(directory, "root.txt"), "one\ntwo\n");
  const root = commit(directory, "root");
  const rootFiles = await loadCommitFiles(directory, root);
  expect(rootFiles.error).toBeNull();
  expect(rootFiles.files).toEqual([
    {
      path: "root.txt",
      oldPath: null,
      status: "A",
      additions: 2,
      deletions: 0,
      binary: false,
    },
  ]);

  writeFileSync(join(directory, "root.txt"), "one\ntwo\nthree\n");
  writeFileSync(join(directory, "added.txt"), "added\n");
  const modified = commit(directory, "modified and added");
  const modifiedFiles = await loadCommitFiles(directory, modified);
  expect(modifiedFiles.files).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "root.txt", status: "M", additions: 1, deletions: 0 }),
      expect.objectContaining({ path: "added.txt", status: "A", additions: 1, deletions: 0 }),
    ]),
  );

  rmSync(join(directory, "added.txt"));
  git(directory, "mv", "root.txt", "renamed.txt");
  const renamed = commit(directory, "delete and rename");
  const renamedFiles = await loadCommitFiles(directory, renamed);
  expect(renamedFiles.files).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "added.txt", status: "D", additions: 0, deletions: 1 }),
      expect.objectContaining({
        path: "renamed.txt",
        oldPath: "root.txt",
        status: "R",
      }),
    ]),
  );

  writeFileSync(join(directory, "asset.bin"), Buffer.from([0, 1, 2, 3, 0]));
  const binary = commit(directory, "binary");
  const binaryFiles = await loadCommitFiles(directory, binary);
  expect(binaryFiles.files).toContainEqual({
    path: "asset.bin",
    oldPath: null,
    status: "A",
    additions: null,
    deletions: null,
    binary: true,
  });
});

it("compares a merge commit with its first parent", async () => {
  const directory = repository();
  writeFileSync(join(directory, "base.txt"), "base\n");
  commit(directory, "base");

  git(directory, "switch", "-c", "feature");
  writeFileSync(join(directory, "feature.txt"), "feature\n");
  commit(directory, "feature");

  git(directory, "switch", "main");
  writeFileSync(join(directory, "main.txt"), "main\n");
  commit(directory, "main");
  git(directory, "merge", "--no-ff", "feature", "-m", "merge feature");
  const merge = git(directory, "rev-parse", "HEAD").trim();

  const files = await loadCommitFiles(directory, merge);
  expect(files.error).toBeNull();
  expect(files.files.map((file) => file.path)).toEqual(["feature.txt"]);
});
