import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { memo, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import type { CommitDetailState } from "./commit-detail-state";
import { CommitDetails } from "./commit-details";
import type { PatchState } from "./patch-state";
import { selectedRowIndex, type RefBadge, type DisplayRow } from "./graph-rows";
import { GraphLanes, laneColor, maxGraphWidth } from "./graph-lanes";
import { laneX } from "./graph-geometry";

const ROW_HEIGHT = 24;
const GRAPH_WIDTH_MIN = 180;
const COMPACT_GRAPH_WIDTH_MIN = 96;
const META_WIDTH = {
  date: 82,
  author: 92,
  commit: 70,
} as const;

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function RefPill({
  badge,
  compact,
  current,
  theme,
}: {
  badge: RefBadge;
  compact: boolean;
  current: boolean;
  theme: PluginWorkspacePanelProps["theme"];
}) {
  const color =
    badge.kind === "tag"
      ? theme.colors.statusWarning
      : current
        ? theme.colors.accent
        : laneColor(badge.colorIndex ?? 0);
  return (
    <View
      style={{
        maxWidth: compact ? 150 : 230,
        height: 18,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 5,
        borderWidth: 1,
        borderColor: current ? theme.colors.accent : "rgba(128,128,128,0.62)",
        backgroundColor: "rgba(128,128,128,0.14)",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: 16,
          height: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: color,
        }}
      >
        <Icon
          name={badge.kind === "tag" ? "Tag" : "GitBranch"}
          size={9}
          color={theme.colors.surface0}
        />
      </View>
      <Text
        numberOfLines={1}
        ellipsizeMode="middle"
        style={{
          minWidth: 0,
          flexShrink: 1,
          paddingHorizontal: 5,
          color: theme.colors.foreground,
          fontSize: 10.5,
          fontWeight: current ? "700" : "500",
        }}
      >
        {badge.label}
      </Text>
      {badge.remoteName ? (
        <View
          style={{
            height: 16,
            paddingHorizontal: 4,
            justifyContent: "center",
            borderLeftWidth: 1,
            borderLeftColor: "rgba(128,128,128,0.45)",
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.foregroundMuted,
              fontSize: 9.5,
              fontStyle: "italic",
            }}
          >
            {badge.remoteName}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const CommitRow = memo(function CommitRow({
  item,
  graphWidth,
  compact,
  currentBranch,
  theme,
  selected,
  onPress,
}: {
  item: Extract<DisplayRow, { kind: "commit" }>;
  graphWidth: number;
  compact: boolean;
  currentBranch: string | null;
  theme: PluginWorkspacePanelProps["theme"];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: selected }}
      onPress={onPress}
      style={{
        height: ROW_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: selected ? theme.colors.surface2 : theme.colors.surface0,
        borderBottomWidth: 1,
        borderBottomColor: `${theme.colors.border}55`,
      }}
    >
      <View style={{ width: graphWidth, height: ROW_HEIGHT }}>
        <GraphLanes row={item.row} height={ROW_HEIGHT} width={graphWidth} theme={theme} />
      </View>
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          paddingRight: 10,
        }}
      >
        {item.badges.slice(0, compact ? 2 : 3).map((badge) => (
          <RefPill
            key={`${badge.kind}:${badge.label}`}
            badge={badge}
            compact={compact}
            current={badge.kind === "local" && badge.label === currentBranch}
            theme={theme}
          />
        ))}
        {item.badges.length > (compact ? 2 : 3) ? (
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 10 }}>
            +{item.badges.length - (compact ? 2 : 3)}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          style={{
            minWidth: 0,
            flexShrink: 1,
            color: theme.colors.foreground,
            fontSize: 12.5,
            fontWeight: "500",
          }}
        >
          {item.row.subject}
        </Text>
      </View>
      <Text style={{ width: META_WIDTH.date, color: theme.colors.foregroundMuted, fontSize: 11.5 }}>
        {formatDate(item.row.date)}
      </Text>
      {compact ? null : (
        <Text
          numberOfLines={1}
          style={{
            width: META_WIDTH.author,
            color: theme.colors.foregroundMuted,
            fontSize: 11.5,
          }}
        >
          {item.row.author}
        </Text>
      )}
      <Text
        style={{
          width: META_WIDTH.commit,
          paddingRight: 10,
          color: theme.colors.foregroundMuted,
          fontFamily: "monospace",
          fontSize: 10.5,
        }}
      >
        {item.row.shortHash}
      </Text>
    </Pressable>
  );
});

function WorkingTreeRow({
  item,
  graphWidth,
  theme,
}: {
  item: Extract<DisplayRow, { kind: "working-tree" }>;
  graphWidth: number;
  theme: PluginWorkspacePanelProps["theme"];
}) {
  const centerY = ROW_HEIGHT / 2;
  const nodeColor = laneColor(item.color);
  return (
    <View
      style={{
        height: ROW_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.surface1,
      }}
    >
      <View style={{ width: graphWidth, height: ROW_HEIGHT }}>
        <View
          style={{
            position: "absolute",
            left: laneX(item.lane) - 1,
            top: centerY,
            width: 2,
            height: centerY,
            borderRadius: 2,
            backgroundColor: nodeColor,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: laneX(item.lane) - 4,
            top: centerY - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: nodeColor,
            backgroundColor: theme.colors.surface1,
          }}
        />
      </View>
      <Text
        numberOfLines={1}
        style={{ flex: 1, color: theme.colors.foreground, fontSize: 12, fontWeight: "600" }}
      >
        Uncommitted changes ({item.count})
      </Text>
      <Text style={{ width: 120, color: theme.colors.foregroundMuted, fontSize: 11 }}>
        {item.additions > 0 ? `+${item.additions}` : ""}{" "}
        {item.deletions > 0 ? `−${item.deletions}` : ""}
      </Text>
    </View>
  );
}

export function GraphList({
  rows,
  theme,
  compact,
  currentBranch,
  loadingMore,
  onEndReached,
  detail,
  onToggleCommit,
  onCloseDetail,
  onSelectPath,
  patchState,
  onBackToFiles,
}: {
  rows: DisplayRow[];
  theme: PluginWorkspacePanelProps["theme"];
  compact: boolean;
  currentBranch: string | null;
  loadingMore: boolean;
  onEndReached: () => void;
  detail: CommitDetailState;
  patchState: PatchState;
  onToggleCommit: (hash: string) => void;
  onCloseDetail: () => void;
  onSelectPath?: (file: import("../shared/git-graph").CommitFile) => void;
  onBackToFiles: () => void;
}) {
  const listRef = useRef<FlatList<DisplayRow>>(null);
  const graphWidth = useMemo(
    () =>
      Math.max(
        compact ? COMPACT_GRAPH_WIDTH_MIN : GRAPH_WIDTH_MIN,
        maxGraphWidth(rows.flatMap((row) => (row.kind === "commit" ? [row.row] : []))),
      ),
    [compact, rows],
  );

  useEffect(() => {
    const index = selectedRowIndex(rows, detail.selectedHash);
    if (index < 0) return;
    listRef.current?.scrollToIndex({
      index,
      viewPosition: 0.15,
      animated: true,
    });
  }, [detail.selectedHash]);

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View
        style={{
          height: 31,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.colors.surface1,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Text
          style={{
            width: graphWidth,
            paddingLeft: 9,
            color: theme.colors.foregroundMuted,
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 0.35,
          }}
        >
          GRAPH
        </Text>
        <Text
          style={{
            flex: 1,
            color: theme.colors.foregroundMuted,
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 0.35,
          }}
        >
          DESCRIPTION
        </Text>
        <Text
          style={{
            width: META_WIDTH.date,
            color: theme.colors.foregroundMuted,
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 0.35,
          }}
        >
          DATE
        </Text>
        {compact ? null : (
          <Text
            style={{
              width: META_WIDTH.author,
              color: theme.colors.foregroundMuted,
              fontSize: 10,
              fontWeight: "600",
              letterSpacing: 0.35,
            }}
          >
            AUTHOR
          </Text>
        )}
        <Text
          style={{
            width: META_WIDTH.commit,
            color: theme.colors.foregroundMuted,
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 0.35,
          }}
        >
          COMMIT
        </Text>
      </View>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) =>
          item.kind === "working-tree" ? "working-tree" : `commit:${item.row.hash}`
        }
        renderItem={({ item }) =>
          item.kind === "working-tree" ? (
            <WorkingTreeRow item={item} graphWidth={graphWidth} theme={theme} />
          ) : (
            <View>
              <CommitRow
                item={item}
                graphWidth={graphWidth}
                compact={compact}
                currentBranch={currentBranch}
                theme={theme}
                selected={detail.selectedHash === item.row.hash}
                onPress={() => onToggleCommit(item.row.hash)}
              />
              {detail.selectedHash === item.row.hash ? (
                <CommitDetails
                  row={item.row}
                  files={detail.files}
                  loading={detail.loading}
                  error={detail.error}
                  graphWidth={graphWidth}
                  theme={theme}
                  onClose={onCloseDetail}
                  onSelectPath={onSelectPath}
                  patchState={patchState}
                  onBackToFiles={onBackToFiles}
                />
              ) : null}
            </View>
          )
        }
        initialNumToRender={40}
        maxToRenderPerBatch={40}
        windowSize={12}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, index * averageItemLength - ROW_HEIGHT),
            animated: true,
          });
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ height: 38, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="small" color={theme.colors.foregroundMuted} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

export function GraphEmpty({
  title,
  detail,
  theme,
}: {
  title: string;
  detail?: string;
  theme: PluginWorkspacePanelProps["theme"];
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }}>
      <Icon name="GitBranch" size={20} color={theme.colors.foregroundMuted} />
      <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600" }}>{title}</Text>
      {detail ? (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11, textAlign: "center" }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
