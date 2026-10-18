import { expect, it } from "vitest";
import { commitPatchRpc, graphPageRpc } from "../shared/git-graph";

it("accepts a 200-row page request and rejects a zero limit", () => {
  expect(
    graphPageRpc.input.parse({
      directory: "/tmp/repo",
      cursor: "0",
      limit: 200,
    }),
  ).toEqual({ directory: "/tmp/repo", cursor: "0", limit: 200 });

  expect(() =>
    graphPageRpc.input.parse({
      directory: "/tmp/repo",
      limit: 0,
    }),
  ).toThrow();
});

it("returns a binary marker and patch text separately", () => {
  expect(
    commitPatchRpc.output.parse({
      patch: "",
      binary: true,
      error: null,
    }),
  ).toEqual({ patch: "", binary: true, error: null });
});
