import { describe, expect, it } from "vitest";
import {
  closeCommitDetail,
  openCommitDetail,
  receiveCommitDetail,
  type CommitDetailState,
} from "../client/commit-detail-state";
import {
  closePatch,
  openPatch,
  receivePatch,
} from "../client/patch-state";

const closed: CommitDetailState = {
  selectedHash: null,
  generation: 0,
  files: [],
  loading: false,
  error: null,
};

describe("commit detail state", () => {
  it("opens only the newest selected commit", () => {
    const first = openCommitDetail(closed, "aaaa", 1);
    const second = openCommitDetail(first, "bbbb", 2);

    expect(first.selectedHash).toBe("aaaa");
    expect(second.selectedHash).toBe("bbbb");
    expect(second.files).toEqual([]);
    expect(second.loading).toBe(true);
  });

  it("closes the expanded commit and releases its files", () => {
    const received = receiveCommitDetail(
      openCommitDetail(closed, "aaaa", 1),
      "aaaa",
      1,
      [{ path: "a.ts", oldPath: null, status: "M", additions: 2, deletions: 1, binary: false }],
    );
    const result = closeCommitDetail(received);

    expect(result.selectedHash).toBeNull();
    expect(result.files).toEqual([]);
    expect(result.loading).toBe(false);
  });

  it("ignores a late response for an older commit or generation", () => {
    const current = openCommitDetail(closed, "bbbb", 2);
    expect(
      receiveCommitDetail(current, "aaaa", 1, [
        { path: "stale.ts", oldPath: null, status: "A", additions: 1, deletions: 0, binary: false },
      ]),
    ).toBe(current);
  });

  it("ignores a late patch response after the user closes it", () => {
    const loading = openPatch(
      { path: null, oldPath: null, generation: 0, loading: false, patch: "", binary: false, error: null },
      { path: "a.ts", oldPath: null },
      1,
    );
    const closed = closePatch(loading);

    expect(
      receivePatch(closed, "a.ts", 1, {
        patch: "+stale",
        binary: false,
        error: null,
      }),
    ).toBe(closed);
  });
});
