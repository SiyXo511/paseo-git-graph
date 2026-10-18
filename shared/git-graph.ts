import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const gitCommitSchema = z.object({
  hash: z.string().min(1),
  shortHash: z.string().min(1),
  parents: z.array(z.string()),
  subject: z.string(),
  author: z.string(),
  date: z.string(),
  refs: z.array(z.string()),
});

export type GitCommit = z.output<typeof gitCommitSchema>;

export const gitRefSchema = z.object({
  name: z.string().min(1),
  hash: z.string().min(1),
  kind: z.enum(["local", "remote", "tag"]),
  remote: z.boolean(),
});

export type GitRef = z.output<typeof gitRefSchema>;

export const headStateSchema = z.object({
  sha: z.string().nullable(),
  branch: z.string().nullable(),
  detached: z.boolean(),
});

export type HeadState = z.output<typeof headStateSchema>;

export const workingTreeSummarySchema = z.object({
  count: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  untracked: z.number().int().nonnegative(),
});

export type WorkingTreeSummary = z.output<typeof workingTreeSummarySchema>;

export const graphRowSchema = z.object({
  hash: z.string(),
  shortHash: z.string(),
  parents: z.array(z.string()),
  subject: z.string(),
  author: z.string(),
  date: z.string(),
  refs: z.array(z.string()),
  lane: z.number().int().nonnegative(),
  color: z.number().int().nonnegative(),
  incomingColor: z.number().int().nonnegative().nullable(),
  edges: z.array(
    z.object({
      from: z.number().int().nonnegative(),
      to: z.number().int().nonnegative(),
      fromTop: z.boolean(),
      color: z.number().int().nonnegative(),
    }),
  ),
});

export type GitRow = z.output<typeof graphRowSchema>;

export const graphPageRpc = defineRpc({
  name: "gitgraph.page",
  input: z.object({
    directory: z.string().min(1),
    cursor: z.string().min(1).max(2048).optional(),
    limit: z.number().int().positive().max(500).default(200),
  }),
  output: z.object({
    commits: z.array(gitCommitSchema),
    refs: z.array(gitRefSchema),
    remotes: z.array(z.string()),
    head: headStateSchema,
    workingTree: workingTreeSummarySchema.nullable(),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    error: z.string().nullable(),
  }),
});

export type GraphPage = z.output<typeof graphPageRpc.output>;

export const commitFileSchema = z.object({
  path: z.string().min(1),
  oldPath: z.string().nullable(),
  status: z.enum(["A", "M", "D", "R", "C", "T", "U"]),
  additions: z.number().int().nonnegative().nullable(),
  deletions: z.number().int().nonnegative().nullable(),
  binary: z.boolean(),
});

export type CommitFile = z.output<typeof commitFileSchema>;

export const commitFilesRpc = defineRpc({
  name: "gitgraph.commit-files",
  input: z.object({
    directory: z.string().min(1),
    hash: z.string().regex(/^[0-9a-f]{40}$/i),
  }),
  output: z.object({
    files: z.array(commitFileSchema),
    error: z.string().nullable(),
  }),
});

export type CommitFiles = z.output<typeof commitFilesRpc.output>;

export const commitPatchRpc = defineRpc({
  name: "gitgraph.commit-patch",
  input: z.object({
    directory: z.string().min(1),
    hash: z.string().regex(/^[0-9a-f]{40}$/i),
    path: z.string().min(1),
    oldPath: z.string().min(1).optional(),
  }),
  output: z.object({
    patch: z.string(),
    binary: z.boolean(),
    error: z.string().nullable(),
  }),
});

export type CommitPatch = z.output<typeof commitPatchRpc.output>;
