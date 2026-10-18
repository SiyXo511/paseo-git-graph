import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useRpc, useWorkspace } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { commitFilesRpc, commitPatchRpc, graphPageRpc, type CommitFile } from "../shared/git-graph";
import {
  closeCommitDetail,
  failCommitDetail,
  initialCommitDetail,
  openCommitDetail,
  receiveCommitDetail,
} from "./commit-detail-state";
import { closePatch, initialPatchState, openPatch, receivePatch } from "./patch-state";
import { GraphEmpty, GraphList } from "./graph-list";
import {
  mergeGraphPage,
  resetGraphPage,
  toDisplayRows,
  visibleGraphError,
  type GraphClientState,
} from "./graph-rows";
import { graphErrorCopy } from "./git-error";

const PAGE_SIZE = 200;

export function GitGraphPanel({ theme, layout, workspaceId }: PluginWorkspacePanelProps) {
  const workspace = useWorkspace(workspaceId, (value) => ({ directory: value.directory }));
  const getPage = useRpc(graphPageRpc);
  const getFiles = useRpc(commitFilesRpc);
  const getPatch = useRpc(commitPatchRpc);
  const [state, setState] = useState<GraphClientState | null>(null);
  const [detail, setDetail] = useState(initialCommitDetail);
  const [patchState, setPatchState] = useState(initialPatchState);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const generation = useRef(0);
  const directory = workspace?.directory ?? null;

  const loadFirstPage = useCallback(async () => {
    if (!directory) return;
    const currentGeneration = generation.current + 1;
    generation.current = currentGeneration;
    setDetail((current) => closeCommitDetail(current));
    setPatchState((current) => closePatch(current));
    setLoading(true);
    setLoadingMore(false);
    setRequestError(null);
    try {
      const page = await getPage({ directory, limit: PAGE_SIZE });
      if (generation.current === currentGeneration) {
        setState(resetGraphPage(page, currentGeneration));
      }
    } catch (error) {
      if (generation.current === currentGeneration) {
        setRequestError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (generation.current === currentGeneration) setLoading(false);
    }
  }, [directory, getPage]);

  useEffect(() => {
    setState(null);
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (
      !directory ||
      !state ||
      !state.hasMore ||
      !state.nextCursor ||
      loading ||
      loadingMore
    ) {
      return;
    }
    const currentGeneration = generation.current;
    const cursor = state.nextCursor;
    setLoadingMore(true);
    try {
      const page = await getPage({
        directory,
        cursor,
        limit: PAGE_SIZE,
      });
      if (generation.current === currentGeneration) {
        setState((current) =>
          current ? mergeGraphPage(current, page, currentGeneration) : current,
        );
      }
    } catch (error) {
      if (generation.current === currentGeneration) {
        setRequestError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (generation.current === currentGeneration) setLoadingMore(false);
    }
  }, [directory, getPage, loading, loadingMore, state]);

  const displayRows = useMemo(
    () => (state ? toDisplayRows(state.commits, state.refs, state.workingTree) : []),
    [state],
  );

  const toggleCommit = useCallback(
    (hash: string) => {
      if (!directory) return;
      if (detail.selectedHash === hash) {
        setDetail((current) => closeCommitDetail(current));
        setPatchState((current) => closePatch(current));
        return;
      }

      const nextGeneration = detail.generation + 1;
      setDetail((current) => openCommitDetail(current, hash, nextGeneration));
      setPatchState((current) => closePatch(current));
      void getFiles({ directory, hash })
        .then((result) => {
          if (result.error) {
            setDetail((current) =>
              failCommitDetail(current, hash, nextGeneration, result.error ?? "Could not read files"),
            );
          } else {
            setDetail((current) =>
              receiveCommitDetail(current, hash, nextGeneration, result.files),
            );
          }
        })
        .catch((error: unknown) => {
          setDetail((current) =>
            failCommitDetail(
              current,
              hash,
              nextGeneration,
              error instanceof Error ? error.message : String(error),
            ),
          );
        });
    },
    [detail.generation, detail.selectedHash, directory, getFiles],
  );

  const selectFile = useCallback(
    (file: CommitFile) => {
      if (!directory || !detail.selectedHash) return;
      const hash = detail.selectedHash;
      const nextGeneration = patchState.generation + 1;
      setPatchState((current) => openPatch(current, file, nextGeneration));
      if (file.binary) {
        setPatchState((current) =>
          receivePatch(current, file.path, nextGeneration, {
            patch: "",
            binary: true,
            error: null,
          }),
        );
        return;
      }

      void getPatch({
        directory,
        hash,
        path: file.path,
        ...(file.oldPath ? { oldPath: file.oldPath } : {}),
      })
        .then((result) => {
          setPatchState((current) => receivePatch(current, file.path, nextGeneration, result));
        })
        .catch((error: unknown) => {
          setPatchState((current) =>
            receivePatch(current, file.path, nextGeneration, {
              patch: "",
              binary: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        });
    },
    [detail.selectedHash, directory, getPatch, patchState.generation],
  );

  if (!workspace) {
    return <GraphEmpty title="Workspace unavailable" theme={theme} />;
  }

  const branchLabel = state?.head.branch ?? (state?.head.sha ? "HEAD" : null);
  const error = visibleGraphError(requestError, state?.error ?? null);
  const errorCopy = error ? graphErrorCopy(error) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <View
        style={{
          height: 34,
          paddingHorizontal: 7,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: theme.colors.surface1,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh Git Graph"
          disabled={loading}
          onPress={() => void loadFirstPage()}
          style={{
            width: 26,
            height: 26,
            borderRadius: 4,
            alignItems: "center",
            justifyContent: "center",
            opacity: loading ? 0.5 : 1,
          }}
        >
          <Icon name="RefreshCw" size={15} color={theme.colors.foreground} />
        </Pressable>
        {branchLabel ? (
          <View
            style={{
              maxWidth: layout.compact ? 160 : 280,
              height: 22,
              paddingHorizontal: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              borderRadius: 11,
              backgroundColor: `${theme.colors.accent}18`,
              borderWidth: 1,
              borderColor: `${theme.colors.accent}55`,
            }}
          >
            <Icon name="GitBranch" size={12} color={theme.colors.accent} />
            <Text
              numberOfLines={1}
              style={{ color: theme.colors.foreground, fontSize: 11, fontWeight: "600" }}
            >
              {branchLabel}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {loading ? <ActivityIndicator size="small" color={theme.colors.foregroundMuted} /> : null}
      </View>

      {error && displayRows.length > 0 ? (
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: `${theme.colors.statusDanger}18`,
            borderBottomWidth: 1,
            borderBottomColor: `${theme.colors.statusDanger}66`,
          }}
        >
          <Text style={{ color: theme.colors.statusDanger, fontSize: 10 }}>
            {errorCopy?.title ?? "Refresh failed"} · {errorCopy?.detail ?? error}
          </Text>
        </View>
      ) : null}

      {error && displayRows.length === 0 ? (
        <GraphEmpty
          title={errorCopy?.title ?? "Git unavailable"}
          detail={errorCopy?.detail}
          theme={theme}
        />
      ) : displayRows.length === 0 && !loading ? (
        <GraphEmpty
          title={state?.head.sha ? "No commits found" : "No commits yet"}
          detail={state?.head.sha ? undefined : "The repository has no committed history."}
          theme={theme}
        />
      ) : (
        <GraphList
          rows={displayRows}
          theme={theme}
          compact={layout.compact}
          currentBranch={state?.head.branch ?? null}
          loadingMore={loadingMore}
          onEndReached={() => void loadMore()}
          detail={detail}
          onToggleCommit={toggleCommit}
          onCloseDetail={() => {
            setDetail((current) => closeCommitDetail(current));
            setPatchState((current) => closePatch(current));
          }}
          patchState={patchState}
          onSelectPath={selectFile}
          onBackToFiles={() => setPatchState((current) => closePatch(current))}
        />
      )}
    </View>
  );
}
