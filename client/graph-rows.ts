import type {
  GitCommit,
  GitRef,
  GitRow,
  GraphPage,
  HeadState,
  WorkingTreeSummary,
} from "../shared/git-graph";
import { computeGraph } from "../shared/compute-graph";

export type GraphClientState = {
  commits: GitCommit[];
  rows: GitRow[];
  refs: GitRef[];
  remotes: string[];
  head: HeadState;
  workingTree: WorkingTreeSummary | null;
  nextCursor: string | null;
  hasMore: boolean;
  generation: number;
  error: string | null;
};

export type RefBadge = {
  label: string;
  kind: "local" | "remote" | "tag";
  remote: boolean;
  remoteName?: string;
  colorIndex?: number;
};

export type DisplayRow =
  | {
      kind: "commit";
      row: GitRow;
      badges: RefBadge[];
    }
  | {
      kind: "working-tree";
      count: number;
      additions: number;
      deletions: number;
      untracked: number;
      lane: number;
      color: number;
    };

export function visibleGraphError(
  requestError: string | null,
  stateError: string | null,
): string | null {
  return requestError ?? stateError;
}

export function selectedRowIndex(rows: DisplayRow[], hash: string | null): number {
  if (!hash) return -1;
  return rows.findIndex((row) => row.kind === "commit" && row.row.hash === hash);
}

export function resetGraphPage(page: GraphPage, generation: number): GraphClientState {
  return {
    commits: page.commits,
    rows: computeGraph(page.commits),
    refs: page.refs,
    remotes: page.remotes,
    head: page.head,
    workingTree: page.workingTree,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    generation,
    error: page.error,
  };
}

export function mergeGraphPage(
  current: GraphClientState,
  page: GraphPage,
  responseGeneration: number,
): GraphClientState {
  if (responseGeneration !== current.generation) return current;

  const byHash = new Map<string, GitCommit>();
  for (const commit of current.commits) byHash.set(commit.hash, commit);
  for (const commit of page.commits) {
    if (!byHash.has(commit.hash)) byHash.set(commit.hash, commit);
  }
  const commits = [...byHash.values()];

  return {
    commits,
    rows: computeGraph(commits),
    refs: page.refs.length > 0 ? page.refs : current.refs,
    remotes: page.remotes.length > 0 ? page.remotes : current.remotes,
    head: page.head,
    workingTree: page.workingTree,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    generation: current.generation,
    error: page.error,
  };
}

function badgeFor(raw: string, refsByName: Map<string, GitRef>): RefBadge | null {
  let label = raw.trim();
  if (!label) return null;
  if (label.startsWith("HEAD -> ")) label = label.slice("HEAD -> ".length);
  if (label.startsWith("tag: ")) {
    return { label: label.slice("tag: ".length), kind: "tag", remote: false };
  }
  if (label === "HEAD") return null;
  const ref = refsByName.get(label);
  if (ref) {
    return { label: ref.name, kind: ref.kind, remote: ref.remote };
  }
  return {
    label,
    kind: label.includes("/") ? "remote" : "local",
    remote: label.includes("/"),
  };
}

function normalizeBadges(
  badges: RefBadge[],
  branchColour: (label: string) => number,
): RefBadge[] {
  const result: RefBadge[] = [];
  const assignBranchColour = (badge: RefBadge) => {
    badge.colorIndex = branchColour(badge.label);
  };
  const appendRemote = (badge: RefBadge, remoteName: string) => {
    badge.remoteName = badge.remoteName
      ? `${badge.remoteName}, ${remoteName}`
      : remoteName;
  };
  const localByLabel = new Map<string, RefBadge>();
  const tagByLabel = new Map<string, RefBadge>();

  for (const badge of badges) {
    if (badge.kind === "local" && !localByLabel.has(badge.label)) {
      assignBranchColour(badge);
      localByLabel.set(badge.label, badge);
      result.push(badge);
    }
  }

  for (const badge of badges) {
    if (badge.kind !== "remote") continue;
    const separator = badge.label.indexOf("/");
    if (separator < 1) continue;
    const remoteName = badge.label.slice(0, separator);
    const branchName = badge.label.slice(separator + 1);
    if (!branchName || branchName === "HEAD") continue;
    const local = localByLabel.get(branchName);
    if (local) {
      appendRemote(local, remoteName);
      continue;
    }
    const existing = result.find(
      (candidate) => candidate.kind === "remote" && candidate.label === branchName,
    );
    if (existing) {
      appendRemote(existing, remoteName);
    } else {
      const remoteBadge: RefBadge = {
        label: branchName,
        kind: "remote",
        remote: true,
      };
      assignBranchColour(remoteBadge);
      appendRemote(remoteBadge, remoteName);
      result.push(remoteBadge);
    }
  }

  for (const badge of badges) {
    if (badge.kind === "tag" && !tagByLabel.has(badge.label)) {
      tagByLabel.set(badge.label, badge);
      result.push(badge);
    }
  }
  return result;
}

export function toDisplayRows(
  commits: GitCommit[],
  refs: GitRef[],
  workingTree: WorkingTreeSummary | null = null,
): DisplayRow[] {
  const refsByName = new Map(refs.map((ref) => [ref.name, ref]));
  const branchColours = [2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];
  const colourByBranch = new Map<string, number>();
  let nextBranchColour = 0;
  const branchColour = (label: string) => {
    const existing = colourByBranch.get(label);
    if (existing !== undefined) return existing;
    const colour = branchColours[nextBranchColour % branchColours.length];
    nextBranchColour += 1;
    colourByBranch.set(label, colour);
    return colour;
  };
  const rows = computeGraph(commits).map((row): DisplayRow => {
    const badges: RefBadge[] = [];
    for (const raw of row.refs) {
      const badge = badgeFor(raw, refsByName);
      if (!badge) continue;
      badges.push(badge);
    }
    return { kind: "commit", row, badges: normalizeBadges(badges, branchColour) };
  });

  if (!workingTree) return rows;
  const headRow = rows[0];
  const headCommit = headRow?.kind === "commit" ? headRow.row : null;
  if (headRow?.kind === "commit") {
    rows[0] = {
      ...headRow,
      row: {
        ...headRow.row,
        edges: [
          ...headRow.row.edges,
          {
            from: headRow.row.lane,
            to: headRow.row.lane,
            fromTop: true,
            color: headRow.row.color,
          },
        ],
      },
    };
  }
  return [
    {
      kind: "working-tree",
      count: workingTree.count,
      additions: workingTree.additions,
      deletions: workingTree.deletions,
      untracked: workingTree.untracked,
      lane: headCommit?.lane ?? 0,
      color: headCommit?.color ?? 0,
    },
    ...rows,
  ];
}
