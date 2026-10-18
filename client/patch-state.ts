import type { CommitPatch } from "../shared/git-graph";

export type PatchState = {
  path: string | null;
  oldPath: string | null;
  generation: number;
  loading: boolean;
  patch: string;
  binary: boolean;
  error: string | null;
};

export function initialPatchState(): PatchState {
  return {
    path: null,
    oldPath: null,
    generation: 0,
    loading: false,
    patch: "",
    binary: false,
    error: null,
  };
}

export function openPatch(
  current: PatchState,
  file: { path: string; oldPath: string | null },
  generation = current.generation + 1,
): PatchState {
  return {
    path: file.path,
    oldPath: file.oldPath,
    generation,
    loading: true,
    patch: "",
    binary: false,
    error: null,
  };
}

export function receivePatch(
  current: PatchState,
  path: string,
  generation: number,
  result: CommitPatch,
): PatchState {
  if (current.path !== path || current.generation !== generation) return current;
  return {
    ...current,
    loading: false,
    patch: result.patch,
    binary: result.binary,
    error: result.error,
  };
}

export function closePatch(current: PatchState): PatchState {
  return {
    ...current,
    path: null,
    oldPath: null,
    generation: current.generation + 1,
    loading: false,
    patch: "",
    binary: false,
    error: null,
  };
}
