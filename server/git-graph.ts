import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import type {
  CommitFile,
  CommitFiles,
  GitCommit,
  GitRef,
  GraphPage,
  HeadState,
  WorkingTreeSummary,
} from "../shared/git-graph";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 32 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

type CursorData = {
  offset: number;
  fingerprint: string;
};

type GitPageInput = {
  directory: string;
  cursor?: string;
  limit: number;
};

class GitReadError extends Error {}

async function git(
  directory: string,
  args: string[],
  options: { allowFailure?: boolean } = {},
): Promise<string> {
  try {
    const result = await execFileAsync("git", args, {
      cwd: directory,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      maxBuffer: MAX_BUFFER,
      timeout: TIMEOUT_MS,
      windowsHide: true,
    });
    return result.stdout;
  } catch (error) {
    if (options.allowFailure) return "";
    const stderr =
      typeof error === "object" && error && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : "";
    throw new GitReadError(stderr || (error instanceof Error ? error.message : String(error)));
  }
}

function encodeCursor(cursor: CursorData): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string): CursorData | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<CursorData>;
    if (
      typeof parsed.offset !== "number" ||
      !Number.isInteger(parsed.offset) ||
      parsed.offset < 0 ||
      typeof parsed.fingerprint !== "string" ||
      !/^[0-9a-f]{64}$/.test(parsed.fingerprint)
    ) {
      return null;
    }
    return { offset: parsed.offset, fingerprint: parsed.fingerprint };
  } catch {
    return null;
  }
}

function emptyPage(error: string | null): GraphPage {
  return {
    commits: [],
    refs: [],
    remotes: [],
    head: { sha: null, branch: null, detached: false },
    workingTree: null,
    nextCursor: null,
    hasMore: false,
    error,
  };
}

function parseRefs(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseCommits(output: string): GitCommit[] {
  return output
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter(Boolean)
    .map((line) => {
      const [hash = "", parents = "", author = "", date = "", refs = "", subject = ""] =
        line.split("\x1f");
      return {
        hash,
        shortHash: hash.slice(0, 7),
        parents: parents.split(" ").filter(Boolean),
        subject,
        author,
        date,
        refs: parseRefs(refs),
      };
    })
    .filter((commit) => commit.hash.length > 0);
}

function normalizeNumstatPath(raw: string): string {
  if (!raw.includes("=>")) return raw;
  const brace = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(raw);
  if (brace) return `${brace[1]}${brace[3]}${brace[4]}`;
  const arrow = /^(.*) => (.*)$/.exec(raw);
  return arrow ? arrow[2] : raw;
}

async function readRefs(directory: string): Promise<GitRef[]> {
  const output = await git(
    directory,
    [
      "for-each-ref",
      "--format=%(refname)%00%(refname:short)%00%(objectname)%00%(*objectname)%00%(objecttype)%00%(*objecttype)",
      "refs/heads",
      "refs/remotes",
      "refs/tags",
    ],
    { allowFailure: true },
  );

  const refs: GitRef[] = [];
  for (const line of output.split("\n")) {
    if (!line) continue;
    const [full = "", name = "", objectHash = "", peeledHash = "", objectType = "", peeledType = ""] =
      line.split("\0");
    if (!name || name.endsWith("/HEAD")) continue;
    const hash = peeledType === "commit" ? peeledHash : objectType === "commit" ? objectHash : "";
    if (!hash) continue;
    const kind = full.startsWith("refs/heads/")
      ? "local"
      : full.startsWith("refs/remotes/")
        ? "remote"
        : full.startsWith("refs/tags/")
          ? "tag"
          : null;
    if (!kind) continue;
    refs.push({ name, hash, kind, remote: kind === "remote" });
  }
  return refs;
}

async function readHead(directory: string): Promise<HeadState> {
  const sha = (await git(directory, ["rev-parse", "--verify", "HEAD^{commit}"], { allowFailure: true }))
    .trim()
    .split("\n")[0];
  const branch = (
    await git(directory, ["symbolic-ref", "--quiet", "--short", "HEAD"], { allowFailure: true })
  )
    .trim()
    .split("\n")[0];
  const commit = sha || null;
  return {
    sha: commit,
    branch: branch || null,
    detached: Boolean(commit && !branch),
  };
}

async function readWorkingTree(directory: string): Promise<WorkingTreeSummary | null> {
  const status = await git(directory, ["status", "--porcelain"], { allowFailure: true });
  const lines = status.split("\n").filter(Boolean);
  if (lines.length === 0) return null;

  const numstat = await git(directory, ["diff", "HEAD", "--numstat"], { allowFailure: true });
  let additions = 0;
  let deletions = 0;
  for (const line of numstat.split("\n")) {
    if (!line) continue;
    const [added = "0", deleted = "0"] = line.split("\t");
    additions += Number.parseInt(added, 10) || 0;
    deletions += Number.parseInt(deleted, 10) || 0;
  }

  return {
    count: lines.length,
    additions,
    deletions,
    untracked: lines.filter((line) => line.startsWith("??")).length,
  };
}

async function repositoryFingerprint(directory: string): Promise<string> {
  const [head, refs] = await Promise.all([
    git(directory, ["rev-parse", "--verify", "HEAD"], { allowFailure: true }),
    git(
      directory,
      [
        "for-each-ref",
        "--format=%(refname)%00%(objectname)%00%(*objectname)",
        "refs/heads",
        "refs/remotes",
        "refs/tags",
      ],
      { allowFailure: true },
    ),
  ]);
  return createHash("sha256").update(head).update("\0").update(refs).digest("hex");
}

export async function loadGraphPage(input: GitPageInput): Promise<GraphPage> {
  let directory: string;
  try {
    directory = (await git(input.directory, ["rev-parse", "--show-toplevel"])).trim();
  } catch (error) {
    return emptyPage(error instanceof Error ? error.message : String(error));
  }

  const limit = input.limit;

  try {
    const fingerprint = await repositoryFingerprint(directory);
    const cursor = input.cursor ? decodeCursor(input.cursor) : { offset: 0, fingerprint };
    if (!cursor) return emptyPage("Invalid continuation cursor.");
    if (cursor.fingerprint !== fingerprint) {
      return emptyPage("Repository refs changed while paging; refresh the graph.");
    }
    const offset = cursor.offset;
    const [log, refs, remotesOutput, head, workingTree] = await Promise.all([
      git(directory, [
        "log",
        "--topo-order",
        "--all",
        "--decorate=short",
        "--date=iso-strict",
        "--pretty=format:%H%x1f%P%x1f%an%x1f%aI%x1f%D%x1f%s",
        `--skip=${offset}`,
        `-n${limit + 1}`,
      ]),
      readRefs(directory),
      git(directory, ["remote"], { allowFailure: true }),
      readHead(directory),
      readWorkingTree(directory),
    ]);
    const afterFingerprint = await repositoryFingerprint(directory);
    if (afterFingerprint !== fingerprint) {
      return emptyPage("Repository refs changed while reading; refresh the graph.");
    }
    const parsed = parseCommits(log);
    const hasMore = parsed.length > limit;
    const commits = parsed.slice(0, limit);

    return {
      commits,
      refs,
      remotes: remotesOutput.split("\n").map((value) => value.trim()).filter(Boolean),
      head,
      workingTree,
      nextCursor: hasMore
        ? encodeCursor({ offset: offset + limit, fingerprint })
        : null,
      hasMore,
      error: null,
    };
  } catch (error) {
    return emptyPage(error instanceof Error ? error.message : String(error));
  }
}

async function comparisonBase(directory: string, hash: string): Promise<string> {
  const parent = (await git(directory, ["rev-parse", "--verify", `${hash}^`], { allowFailure: true }))
    .trim()
    .split("\n")[0];
  return parent || EMPTY_TREE;
}

export async function loadCommitFiles(directory: string, hash: string): Promise<CommitFiles> {
  try {
    const base = await comparisonBase(directory, hash);
    const [numstat, nameStatus] = await Promise.all([
      git(directory, ["diff", "--numstat", "-M", base, hash]),
      git(directory, ["diff", "--name-status", "-M", base, hash]),
    ]);

    const statuses = new Map<string, { status: CommitFile["status"]; oldPath: string | null }>();
    for (const line of nameStatus.split("\n")) {
      if (!line) continue;
      const parts = line.split("\t");
      const marker = parts[0] ?? "";
      const status = marker.charAt(0) as CommitFile["status"];
      if (status === "R" || status === "C") {
        const oldPath = parts[1];
        const path = parts[2];
        if (path) statuses.set(path, { status, oldPath: oldPath || null });
      } else {
        const path = parts[1];
        if (path) statuses.set(path, { status, oldPath: null });
      }
    }

    const files: CommitFile[] = [];
    for (const line of numstat.split("\n")) {
      if (!line) continue;
      const [added = "0", deleted = "0", ...pathParts] = line.split("\t");
      const path = normalizeNumstatPath(pathParts.join("\t"));
      if (!path) continue;
      const status = statuses.get(path);
      const binary = added === "-" || deleted === "-";
      files.push({
        path,
        oldPath: status?.oldPath ?? null,
        status: status?.status ?? "M",
        additions: binary ? null : Number.parseInt(added, 10) || 0,
        deletions: binary ? null : Number.parseInt(deleted, 10) || 0,
        binary,
      });
    }

    return { files, error: null };
  } catch (error) {
    return {
      files: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function loadCommitPatch(
  directory: string,
  hash: string,
  path: string,
  oldPath?: string,
): Promise<{ patch: string; binary: boolean; error: string | null }> {
  try {
    const files = await loadCommitFiles(directory, hash);
    if (files.error) return { patch: "", binary: false, error: files.error };
    const file = files.files.find((candidate) => candidate.path === path);
    if (file?.binary) return { patch: "", binary: true, error: null };

    const base = await comparisonBase(directory, hash);
    const paths = oldPath && oldPath !== path ? [oldPath, path] : [path];
    const patch = await git(directory, [
      "diff",
      "--no-ext-diff",
      "--unified=3",
      "--find-renames",
      base,
      hash,
      "--",
      ...paths,
    ]);
    return { patch, binary: false, error: null };
  } catch (error) {
    return {
      patch: "",
      binary: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
