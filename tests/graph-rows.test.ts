import { expect, it } from "vitest";
import { selectedRowIndex, toDisplayRows } from "../client/graph-rows";
import type { GitCommit, GitRef } from "../shared/git-graph";

const commits: GitCommit[] = [
  {
    hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    shortHash: "aaaaaaa",
    parents: [],
    subject: "Newest",
    author: "A",
    date: "2026-10-17T00:00:00Z",
    refs: ["HEAD -> main", "origin/main", "tag: v1"],
  },
  {
    hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    shortHash: "bbbbbbb",
    parents: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    subject: "Older",
    author: "B",
    date: "2026-10-16T00:00:00Z",
    refs: ["feature"],
  },
];

const refs: GitRef[] = [
  {
    name: "main",
    hash: commits[0].hash,
    kind: "local",
    remote: false,
  },
  {
    name: "origin/main",
    hash: commits[0].hash,
    kind: "remote",
    remote: true,
  },
  {
    name: "v1",
    hash: commits[0].hash,
    kind: "tag",
    remote: false,
  },
  {
    name: "feature",
    hash: commits[1].hash,
    kind: "local",
    remote: false,
  },
];

it("turns commits into compact rows with typed ref badges", () => {
  const rows = toDisplayRows(commits, refs);

  expect(rows[0]).toMatchObject({
    kind: "commit",
    row: { hash: commits[0].hash, subject: "Newest" },
  });
  expect(rows[0].kind === "commit" ? rows[0].badges : []).toEqual([
    expect.objectContaining({ label: "main", kind: "local", remoteName: "origin" }),
    expect.objectContaining({ label: "v1", kind: "tag" }),
  ]);
});

it("splits remote names from remote-only branch labels", () => {
  const remoteCommit: GitCommit = {
    ...commits[1],
    refs: ["origin/topic"],
  };
  const remoteRef: GitRef = {
    name: "origin/topic",
    hash: remoteCommit.hash,
    kind: "remote",
    remote: true,
  };
  const rows = toDisplayRows([remoteCommit], [remoteRef]);

  expect(rows[0].kind === "commit" ? rows[0].badges : []).toEqual([
    expect.objectContaining({
      label: "topic",
      kind: "remote",
      remote: true,
      remoteName: "origin",
    }),
  ]);
});

it("assigns different stable colours to different branches", () => {
  const twoBranches: GitCommit = {
    ...commits[1],
    refs: ["feature", "bugfix"],
  };
  const rows = toDisplayRows(
    [twoBranches],
    [
      { name: "feature", hash: twoBranches.hash, kind: "local", remote: false },
      { name: "bugfix", hash: twoBranches.hash, kind: "local", remote: false },
    ],
  );
  const badges = rows[0].kind === "commit" ? rows[0].badges : [];

  expect(badges).toHaveLength(2);
  expect(badges[0].colorIndex).not.toBe(badges[1].colorIndex);
});

it("reuses the same colour for the same branch across commits", () => {
  const rows = toDisplayRows(
    [
      { ...commits[0], refs: ["feature"] },
      { ...commits[1], refs: ["feature"] },
    ],
    [{ name: "feature", hash: commits[0].hash, kind: "local", remote: false }],
  );
  const first = rows[0].kind === "commit" ? rows[0].badges[0]?.colorIndex : undefined;
  const second = rows[1].kind === "commit" ? rows[1].badges[0]?.colorIndex : undefined;

  expect(first).toBe(second);
});

it("prepends the working-tree row only when the checkout is dirty", () => {
  expect(toDisplayRows(commits, refs, null)).toHaveLength(2);
  const rows = toDisplayRows(commits, refs, {
    count: 3,
    additions: 7,
    deletions: 2,
    untracked: 1,
  });
  expect(rows[0]).toMatchObject({
    kind: "working-tree",
    count: 3,
    additions: 7,
    deletions: 2,
    lane: 0,
    color: 0,
  });
  expect(rows[1]).toMatchObject({
    kind: "commit",
    row: {
      edges: expect.arrayContaining([
        expect.objectContaining({ from: 0, to: 0, fromTop: true }),
      ]),
    },
  });
});

it("finds the list index of the selected commit", () => {
  const rows = toDisplayRows(commits, refs, {
    count: 1,
    additions: 1,
    deletions: 0,
    untracked: 0,
  });

  expect(selectedRowIndex(rows, commits[1].hash)).toBe(2);
  expect(selectedRowIndex(rows, "missing")).toBe(-1);
});
