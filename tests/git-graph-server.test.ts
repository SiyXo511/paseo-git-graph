import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadGraphPage } from "../server/git-graph";

const directories: string[] = [];

function git(directory: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args],
    { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function repository(): string {
  const directory = mkdtempSync(join(tmpdir(), "paseo-git-graph-"));
  directories.push(directory);
  git(directory, "init", "-b", "main");
  return directory;
}

function seedLinearHistory(directory: string, count: number): void {
  let stream = "blob\nmark :1\ndata 2\n0\n\n";
  for (let index = 0; index < count; index += 1) {
    const message = `commit ${index}`;
    const mark = index + 2;
    stream += `commit refs/heads/main\nmark :${mark}\n`;
    stream += `committer Test <test@example.com> ${1_700_000_000 + index} +0000\n`;
    stream += `data ${Buffer.byteLength(message)}\n${message}\n`;
    if (index > 0) stream += `from :${mark - 1}\n`;
    stream += "M 100644 :1 history.txt\n\n";
  }

  execFileSync("git", ["fast-import", "--quiet"], {
    cwd: directory,
    input: stream,
    stdio: ["pipe", "pipe", "pipe"],
  });
  git(directory, "reset", "--hard", "main");
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("loadGraphPage", () => {
  it(
    "loads 200 commits, continues from the cursor, and keeps every commit once",
    async () => {
    const directory = repository();
    seedLinearHistory(directory, 205);

    git(directory, "switch", "-c", "feature");
    writeFileSync(join(directory, "feature.txt"), "feature\n");
    git(directory, "add", "feature.txt");
    git(directory, "commit", "-m", "feature branch");

    git(directory, "switch", "main");
    writeFileSync(join(directory, "main.txt"), "main\n");
    git(directory, "add", "main.txt");
    git(directory, "commit", "-m", "main branch");
    git(directory, "merge", "--no-ff", "feature", "-m", "merge feature");

    const first = await loadGraphPage({ directory, limit: 200 });
    expect(first.error).toBeNull();
    expect(first.commits).toHaveLength(200);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBeTruthy();
    expect(first.refs.some((ref) => ref.name === "main" && ref.kind === "local")).toBe(true);
    expect(first.refs.some((ref) => ref.name === "feature" && ref.kind === "local")).toBe(true);
    expect(first.head.branch).toBe("main");

    const second = await loadGraphPage({
      directory,
      limit: 200,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.error).toBeNull();
    expect(second.hasMore).toBe(false);
    expect(second.commits.length).toBeGreaterThan(0);

    const hashes = [...first.commits, ...second.commits].map((commit) => commit.hash);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(hashes).toHaveLength(208);
    },
    30_000,
  );

  it("returns an error instead of throwing for a non-Git directory", async () => {
    const directory = mkdtempSync(join(tmpdir(), "paseo-not-git-"));
    directories.push(directory);

    const page = await loadGraphPage({ directory, limit: 200 });
    expect(page.commits).toEqual([]);
    expect(page.error).toBeTruthy();
  });

  it("supports an unborn repository with working-tree changes", async () => {
    const directory = repository();
    writeFileSync(join(directory, "new.txt"), "one\ntwo\n");

    const page = await loadGraphPage({ directory, limit: 200 });
    expect(page.error).toBeNull();
    expect(page.commits).toEqual([]);
    expect(page.head.sha).toBeNull();
    expect(page.workingTree?.count).toBe(1);
    expect(page.workingTree?.untracked).toBe(1);
  });

  it("rejects a continuation cursor after the repository refs change", async () => {
    const directory = repository();
    writeFileSync(join(directory, "one.txt"), "one\n");
    git(directory, "add", "one.txt");
    git(directory, "commit", "-m", "one");
    writeFileSync(join(directory, "two.txt"), "two\n");
    git(directory, "add", "two.txt");
    git(directory, "commit", "-m", "two");

    const first = await loadGraphPage({ directory, limit: 1 });
    expect(first.nextCursor).toBeTruthy();

    writeFileSync(join(directory, "three.txt"), "three\n");
    git(directory, "add", "three.txt");
    git(directory, "commit", "-m", "three");

    const stale = await loadGraphPage({
      directory,
      limit: 1,
      cursor: first.nextCursor ?? undefined,
    });
    expect(stale.error).toContain("changed");
    expect(stale.commits).toEqual([]);
  });
});
