import type { GitCommit, GitRow } from "./git-graph";

type Edge = GitRow["edges"][number];

// Lane allocation follows zfhuang/paseo-git-tree's deterministic topology
// algorithm (MIT), kept pure so paged histories can be re-laned as rows append.
export function computeGraph(commits: GitCommit[]): GitRow[] {
  const lanes: Array<string | null> = [];
  const rows: GitRow[] = [];
  let previousOutgoing: Edge[] = [];

  for (const commit of commits) {
    const before = lanes.slice();
    const segments = new Map<string, Edge>();
    const add = (from: number, to: number, fromTop: boolean, color = from) => {
      segments.set(`${from}>${to}@${fromTop}`, { from, to, fromTop, color });
    };

    // The second half of every transition must use the same source and target
    // lanes as the previous row's outgoing half.
    for (const edge of previousOutgoing) {
      add(edge.from, edge.to, true, edge.color);
    }

    const incomingLanes: number[] = [];
    for (let index = 0; index < lanes.length; index += 1) {
      if (lanes[index] === commit.hash) incomingLanes.push(index);
    }

    let lane: number;
    const collapsed = new Set<number>();
    if (incomingLanes.length > 0) {
      lane = incomingLanes[0];
      for (const duplicate of incomingLanes.slice(1)) {
        lanes[duplicate] = null;
        collapsed.add(duplicate);
      }
    } else {
      lane = lanes.length;
      lanes.push(null);
    }

    const [firstParent, ...otherParents] = commit.parents;
    const firstParentLane =
      firstParent === undefined ? -1 : lanes.indexOf(firstParent);
    // A first parent reserved on a lane further right must be pulled back into
    // this lane so the first-parent spine stays left-aligned, like
    // `git log --graph`. The right lane then curves into this commit instead of
    // the whole later history inheriting its indentation.
    const mergesBackLeft = firstParentLane > lane;

    for (let index = 0; index < before.length; index += 1) {
      if (before[index] === null) continue;
      if (
        index === lane ||
        collapsed.has(index) ||
        (mergesBackLeft && index === firstParentLane)
      ) {
        continue;
      }
      add(index, index, false);
    }

    if (commit.parents.length === 0) {
      lanes[lane] = null;
    } else {
      if (firstParentLane !== -1 && firstParentLane < lane) {
        // The parent already lives further left: this branch curves into it.
        add(lane, firstParentLane, false);
        lanes[lane] = null;
      } else {
        if (mergesBackLeft) {
          lanes[firstParentLane] = null;
          add(firstParentLane, lane, false, firstParentLane);
        }
        lanes[lane] = firstParent;
        add(lane, lane, false);
      }

      for (const parent of otherParents) {
        const parentLane = lanes.indexOf(parent);
        if (parentLane !== -1) {
          add(lane, parentLane, false, parentLane);
          continue;
        }

        let nextLane = lanes.indexOf(null);
        if (nextLane === -1) {
          nextLane = lanes.length;
          lanes.push(null);
        }
        lanes[nextLane] = parent;
        add(lane, nextLane, false, nextLane);
      }
    }

    rows.push({
      hash: commit.hash,
      shortHash: commit.shortHash,
      parents: commit.parents,
      subject: commit.subject,
      author: commit.author,
      date: commit.date,
      refs: commit.refs,
      lane,
      color: lane,
      incomingColor: null,
      edges: [...segments.values()],
    });
    previousOutgoing = [...segments.values()].filter((edge) => !edge.fromTop);
  }

  return rows;
}
