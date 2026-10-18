import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import type { CommitFile, GitRow } from "../shared/git-graph";
import { GraphDetailLane } from "./graph-lanes";
import { PatchView } from "./patch-view";
import type { PatchState } from "./patch-state";

const DETAILS_MAX_HEIGHT = 340;

function statusLabel(status: CommitFile["status"]): string {
  return {
    A: "Added",
    M: "Modified",
    D: "Deleted",
    R: "Renamed",
    C: "Copied",
    T: "Type",
    U: "Unmerged",
  }[status];
}

function statusColor(status: CommitFile["status"], theme: PluginWorkspacePanelProps["theme"]) {
  if (status === "A") return theme.colors.statusSuccess;
  if (status === "D") return theme.colors.statusDanger;
  if (status === "R" || status === "C") return theme.colors.accent;
  return theme.colors.statusWarning;
}

export function CommitDetails({
  row,
  files,
  loading,
  error,
  graphWidth,
  theme,
  onClose,
  onSelectPath,
  patchState,
  onBackToFiles,
}: {
  row: GitRow;
  files: CommitFile[];
  loading: boolean;
  error: string | null;
  graphWidth: number;
  theme: PluginWorkspacePanelProps["theme"];
  onClose: () => void;
  onSelectPath?: (file: CommitFile) => void;
  patchState: PatchState;
  onBackToFiles: () => void;
}) {
  return (
    <View
      style={{
        minHeight: 120,
        maxHeight: DETAILS_MAX_HEIGHT,
        flexDirection: "row",
        backgroundColor: theme.colors.surface1,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View style={{ width: graphWidth, minHeight: 120, maxHeight: DETAILS_MAX_HEIGHT }}>
        <GraphDetailLane row={row} width={graphWidth} theme={theme} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            height: 34,
            paddingLeft: 12,
            paddingRight: 6,
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: theme.colors.foreground, fontSize: 11, fontWeight: "600" }}
          >
            {row.shortHash} · {row.subject}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close commit details"
            hitSlop={8}
            onPress={onClose}
            style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="X" size={14} color={theme.colors.foregroundMuted} />
          </Pressable>
        </View>
        {patchState.path ? (
          <PatchView state={patchState} theme={theme} onBack={onBackToFiles} />
        ) : loading ? (
          <View style={{ height: 72, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="small" color={theme.colors.foregroundMuted} />
          </View>
        ) : error ? (
          <Text style={{ padding: 12, color: theme.colors.statusDanger, fontSize: 11 }}>{error}</Text>
        ) : files.length === 0 ? (
          <Text style={{ padding: 12, color: theme.colors.foregroundMuted, fontSize: 11 }}>
            No file changes
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: DETAILS_MAX_HEIGHT - 34 }}>
            {files.map((file) => (
              <Pressable
                key={`${file.status}:${file.path}`}
                accessibilityRole={onSelectPath ? "button" : undefined}
                onPress={onSelectPath ? () => onSelectPath(file) : undefined}
                style={{
                  minHeight: 28,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: `${theme.colors.border}66`,
                }}
              >
                <Text
                  style={{
                    width: 54,
                    color: statusColor(file.status, theme),
                    fontSize: 10,
                    fontWeight: "600",
                  }}
                >
                  {statusLabel(file.status)}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{ flex: 1, minWidth: 0, color: theme.colors.foreground, fontSize: 11 }}
                >
                  {file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                </Text>
                <Text
                  style={{
                    width: 48,
                    textAlign: "right",
                    color: theme.colors.statusSuccess,
                    fontFamily: "monospace",
                    fontSize: 10,
                  }}
                >
                  {file.binary ? "Binary" : file.additions === null ? "—" : `+${file.additions}`}
                </Text>
                <Text
                  style={{
                    width: 48,
                    textAlign: "right",
                    color: theme.colors.statusDanger,
                    fontFamily: "monospace",
                    fontSize: 10,
                  }}
                >
                  {file.binary || file.deletions === null ? "" : `−${file.deletions}`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
