import type { CommitFile } from "../shared/git-graph";

export type CommitDetailState = {
  selectedHash: string | null;
  generation: number;
  files: CommitFile[];
  loading: boolean;
  error: string | null;
};

export function initialCommitDetail(): CommitDetailState {
  return {
    selectedHash: null,
    generation: 0,
    files: [],
    loading: false,
    error: null,
  };
}

export function openCommitDetail(
  current: CommitDetailState,
  hash: string,
  generation = current.generation + 1,
): CommitDetailState {
  return {
    selectedHash: hash,
    generation,
    files: [],
    loading: true,
    error: null,
  };
}

export function receiveCommitDetail(
  current: CommitDetailState,
  hash: string,
  generation: number,
  files: CommitFile[],
): CommitDetailState {
  if (current.selectedHash !== hash || current.generation !== generation) return current;
  return { ...current, files, loading: false, error: null };
}

export function failCommitDetail(
  current: CommitDetailState,
  hash: string,
  generation: number,
  error: string,
): CommitDetailState {
  if (current.selectedHash !== hash || current.generation !== generation) return current;
  return { ...current, files: [], loading: false, error };
}

export function closeCommitDetail(current: CommitDetailState): CommitDetailState {
  return {
    selectedHash: null,
    generation: current.generation + 1,
    files: [],
    loading: false,
    error: null,
  };
}
