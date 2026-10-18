import { describe, expect, it } from "vitest";
import { mergeGraphPage, resetGraphPage, visibleGraphError } from "../client/graph-rows";
import type { GitCommit, GraphPage } from "../shared/git-graph";

function commit(hash: string, parents: string[] = [], refs: string[] = []): GitCommit {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    parents,
    subject: hash,
    author: "Test",
    date: "2026-10-17T00:00:00Z",
    refs,
  };
}

function page(
  commits: GitCommit[],
  nextCursor: string | null,
  hasMore: boolean,
): GraphPage {
  return {
    commits,
    refs: [],
    remotes: [],
    head: { sha: commits[0]?.hash ?? null, branch: "main", detached: false },
    workingTree: null,
    nextCursor,
    hasMore,
    error: null,
  };
}

describe("graph paging", () => {
  it("keeps refresh errors visible even when an older graph remains on screen", () => {
    expect(visibleGraphError("refresh failed", null)).toBe("refresh failed");
    expect(visibleGraphError(null, "page failed")).toBe("page failed");
    expect(visibleGraphError(null, null)).toBeNull();
  });

  it("deduplicates commits, preserves order, and re-lanes across a page boundary", () => {
    const first = resetGraphPage(page([commit("head", ["middle"]), commit("middle", ["root"])], "2", true), 1);
    const second = mergeGraphPage(first, page([commit("middle", ["root"]), commit("root")], null, false), 1);

    expect(second.commits.map((entry) => entry.hash)).toEqual(["head", "middle", "root"]);
    expect(second.rows.map((entry) => entry.hash)).toEqual(["head", "middle", "root"]);
    expect(second.hasMore).toBe(false);
    expect(second.nextCursor).toBeNull();
  });

  it("resets accumulated history for refresh", () => {
    const old = mergeGraphPage(
      resetGraphPage(page([commit("old")], null, false), 2),
      page([commit("newer"), commit("new")], "2", true),
      2,
    );
    const refreshed = resetGraphPage(page([commit("brand-new")], null, false), 3);

    expect(old.commits.map((entry) => entry.hash)).toEqual(["old", "newer", "new"]);
    expect(refreshed.commits.map((entry) => entry.hash)).toEqual(["brand-new"]);
    expect(refreshed.generation).toBe(3);
  });

  it("ignores a response from an older request generation", () => {
    const current = resetGraphPage(page([commit("current")], null, false), 4);
    expect(mergeGraphPage(current, page([commit("stale")], null, false), 3)).toBe(current);
  });
});
