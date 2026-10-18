import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { classifyPatchLines, type PatchLineKind } from "./patch-lines";
import type { PatchState } from "./patch-state";

const INITIAL_LINES = 500;
const LINE_CHUNK = 500;

function lineColor(kind: PatchLineKind, theme: PluginWorkspacePanelProps["theme"]): string {
  if (kind === "add") return theme.colors.statusSuccess;
  if (kind === "delete") return theme.colors.statusDanger;
  if (kind === "hunk") return theme.colors.accent;
  if (kind === "meta") return theme.colors.foregroundMuted;
  return theme.colors.foreground;
}

function lineBackground(
  kind: PatchLineKind,
  theme: PluginWorkspacePanelProps["theme"],
): string | undefined {
  if (kind === "add") return `${theme.colors.statusSuccess}14`;
  if (kind === "delete") return `${theme.colors.statusDanger}14`;
  if (kind === "hunk") return `${theme.colors.accent}12`;
  return undefined;
}

export function PatchView({
  state,
  theme,
  onBack,
}: {
  state: PatchState;
  theme: PluginWorkspacePanelProps["theme"];
  onBack: () => void;
}) {
  const [visible, setVisible] = useState(INITIAL_LINES);
  const lines = useMemo(() => classifyPatchLines(state.patch), [state.patch]);

  useEffect(() => setVisible(INITIAL_LINES), [state.path, state.patch]);

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View
        style={{
          height: 30,
          paddingHorizontal: 8,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to changed files"
          onPress={onBack}
          style={{ paddingVertical: 5, paddingRight: 10 }}
        >
          <Text style={{ color: theme.colors.accent, fontSize: 11 }}>← Files</Text>
        </Pressable>
        <Text
          numberOfLines={1}
          style={{ flex: 1, minWidth: 0, color: theme.colors.foreground, fontSize: 11 }}
        >
          {state.path}
        </Text>
      </View>
      {state.loading ? (
        <View style={{ flex: 1, minHeight: 100, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="small" color={theme.colors.foregroundMuted} />
        </View>
      ) : state.binary ? (
        <Text style={{ padding: 14, color: theme.colors.foregroundMuted, fontSize: 11 }}>
          Binary file — no textual patch is available.
        </Text>
      ) : state.error ? (
        <Text style={{ padding: 14, color: theme.colors.statusDanger, fontSize: 11 }}>
          {state.error}
        </Text>
      ) : lines.length === 0 ? (
        <Text style={{ padding: 14, color: theme.colors.foregroundMuted, fontSize: 11 }}>
          No textual changes.
        </Text>
      ) : (
        <ScrollView style={{ flex: 1, minHeight: 0 }}>
          <ScrollView horizontal bounces={false}>
            <View style={{ minWidth: 760 }}>
              {lines.slice(0, visible).map((line, index) => (
                <Text
                  key={`${index}:${line.text}`}
                  selectable
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 1,
                    color: lineColor(line.kind, theme),
                    backgroundColor: lineBackground(line.kind, theme),
                    fontFamily: "monospace",
                    fontSize: 10,
                  }}
                >
                  {line.text || " "}
                </Text>
              ))}
              {visible < lines.length ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setVisible((current) => current + LINE_CHUNK)}
                  style={{ padding: 10, alignItems: "center" }}
                >
                  <Text style={{ color: theme.colors.accent, fontSize: 11 }}>
                    Show {Math.min(LINE_CHUNK, lines.length - visible)} more lines
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}
