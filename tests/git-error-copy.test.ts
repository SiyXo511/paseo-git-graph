import { expect, it } from "vitest";
import { graphErrorCopy } from "../client/git-error";

it("distinguishes a non-Git workspace", () => {
  expect(graphErrorCopy("fatal: not a git repository (or any of the parent directories): .git")).toEqual({
    title: "Not a Git repository",
    detail: "Initialize Git in this workspace, then refresh.",
  });
});

it("distinguishes an unborn repository", () => {
  expect(graphErrorCopy("fatal: your current branch 'main' does not have any commits yet")).toEqual({
    title: "No commits yet",
    detail: "Create the first commit, then refresh the graph.",
  });
});

it("asks for a refresh when repository refs change during paging", () => {
  expect(graphErrorCopy("Repository refs changed while paging; refresh the graph.")).toEqual({
    title: "Repository changed",
    detail: "Refresh to continue from the current Git state.",
  });
});

it("uses a generic Git failure message for unknown errors", () => {
  expect(graphErrorCopy("permission denied")).toEqual({
    title: "Unable to read Git history",
    detail: "Check repository access, then refresh.",
  });
});
