import { describe, expect, it } from "vitest";
import { computeGraph } from "../shared/compute-graph";
import type { GitCommit } from "../shared/git-graph";

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

function expectValidEdges(rows: ReturnType<typeof computeGraph>) {
  for (const row of rows) {
    expect(row.lane).toBeGreaterThanOrEqual(0);
    for (const edge of row.edges) {
      expect(edge.from).toBeGreaterThanOrEqual(0);
      expect(edge.to).toBeGreaterThanOrEqual(0);
    }
  }
}

function expectConnectedRows(rows: ReturnType<typeof computeGraph>) {
  for (let index = 1; index < rows.length; index += 1) {
    const previousBottomEdges = [
      ...new Set(
        rows[index - 1].edges
          .filter((edge) => !edge.fromTop)
          .map((edge) => `${edge.from}>${edge.to}`),
      ),
    ].sort((left, right) => left.localeCompare(right));
    const currentTopEdges = [
      ...new Set(
        rows[index].edges
          .filter((edge) => edge.fromTop)
          .map((edge) => `${edge.from}>${edge.to}`),
      ),
    ].sort((left, right) => left.localeCompare(right));
    expect(currentTopEdges).toEqual(previousBottomEdges);
  }
}

describe("computeGraph", () => {
  it("draws a root and a linear history on one lane", () => {
    const rows = computeGraph([commit("ccc", ["bbb"]), commit("bbb", ["aaa"]), commit("aaa")]);

    expect(rows.map((row) => row.lane)).toEqual([0, 0, 0]);
    expectValidEdges(rows);
  });

  it("keeps a fork and merge connected", () => {
    const rows = computeGraph([
      commit("merge", ["left", "right"]),
      commit("left", ["base"]),
      commit("right", ["base"]),
      commit("base"),
    ]);

    expect(rows[0].parents).toEqual(["left", "right"]);
    expect(Math.max(...rows.map((row) => row.lane))).toBeGreaterThan(0);
    expect(rows[0].edges.find((edge) => edge.from === 0 && edge.to === 1)?.color).toBe(1);
    expectValidEdges(rows);
    expectConnectedRows(rows);
  });

  it("supports octopus merges", () => {
    const rows = computeGraph([
      commit("merge", ["a", "b", "c"]),
      commit("a", ["root"]),
      commit("b", ["root"]),
      commit("c", ["root"]),
      commit("root"),
    ]);

    expectValidEdges(rows);
    expectConnectedRows(rows);
    expect(rows.some((row) => row.edges.some((edge) => edge.from !== edge.to))).toBe(true);
  });

  it("converges multiple children into their shared parent", () => {
    const rows = computeGraph([
      commit("third", ["parent"]),
      commit("second", ["parent"]),
      commit("parent"),
    ]);

    expectValidEdges(rows);
    expect(rows[1].edges.some((edge) => edge.from !== edge.to)).toBe(true);
  });

  it("keeps the first-parent spine on the leftmost lane after a merge", () => {
    const rows = computeGraph([
      commit("merge", ["feature", "base"]),
      commit("feature", ["base"]),
      commit("base", ["older"]),
      commit("older"),
    ]);

    expect(rows.map((row) => row.lane)).toEqual([0, 0, 0, 0]);
    expect(
      rows[1].edges.some((edge) => edge.from === 1 && edge.to === 0),
    ).toBe(true);
    expectValidEdges(rows);
    expectConnectedRows(rows);
  });

  it("re-lanes an arbitrary filtered subset without disconnected columns", () => {
    const rows = computeGraph([commit("head", ["middle"]), commit("middle", ["root"]), commit("root")]);
    const filtered = computeGraph(
      [rows[0], rows[2]].map(({ hash, shortHash, parents, subject, author, date, refs }) => ({
        hash,
        shortHash,
        parents,
        subject,
        author,
        date,
        refs,
      })),
    );

    expectValidEdges(filtered);
  });
});
