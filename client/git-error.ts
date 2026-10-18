export type GraphErrorCopy = {
  title: string;
  detail: string;
};

export function graphErrorCopy(error: string): GraphErrorCopy {
  if (/not a git repository|not a git directory/i.test(error)) {
    return {
      title: "Not a Git repository",
      detail: "Initialize Git in this workspace, then refresh.",
    };
  }
  if (
    /does not have any commits yet|ambiguous argument ['"]?HEAD|unknown revision or path not in the working tree/i.test(
      error,
    )
  ) {
    return {
      title: "No commits yet",
      detail: "Create the first commit, then refresh the graph.",
    };
  }
  if (/changed while (paging|reading)|continuation cursor/i.test(error)) {
    return {
      title: "Repository changed",
      detail: "Refresh to continue from the current Git state.",
    };
  }
  return {
    title: "Unable to read Git history",
    detail: "Check repository access, then refresh.",
  };
}
