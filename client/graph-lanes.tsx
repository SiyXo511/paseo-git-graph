import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { View } from "react-native";
import type { GitRow } from "../shared/git-graph";
import { edgeCurveSegments, LANE_PAD, laneX } from "./graph-geometry";

const NODE_RADIUS = 4;
const LINE_WIDTH = 2;

const COLORS = [
  "#0085d9",
  "#d9008f",
  "#00d90a",
  "#d98500",
  "#a300d9",
  "#ff3b30",
  "#00d9cc",
  "#e138e8",
  "#85d900",
  "#dc5b23",
  "#6f24d6",
  "#ffcc00",
];

export function laneColor(index: number): string {
  return COLORS[((index % COLORS.length) + COLORS.length) % COLORS.length];
}

export function graphWidthForRow(row: GitRow): number {
  return Math.max(
    laneX(row.lane),
    ...row.edges.flatMap((edge) => [laneX(edge.from), laneX(edge.to)]),
  ) + LANE_PAD;
}

export function maxGraphWidth(rows: GitRow[]): number {
  return Math.max(48, ...rows.map(graphWidthForRow));
}

export function GraphLanes({
  row,
  height,
  width,
  theme,
}: {
  row: GitRow;
  height: number;
  width: number;
  theme: PluginWorkspacePanelProps["theme"];
}) {
  const centerY = height / 2;
  const nodeX = laneX(row.lane);
  const nodeColor = laneColor(row.color);
  const segments = row.edges.flatMap((edge, edgeIndex) =>
    edgeCurveSegments(edge, height).map((segment, segmentIndex) => {
      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      return {
        key: `${edge.from}>${edge.to}@${edge.fromTop}:${edgeIndex}:${segmentIndex}`,
        segment,
        length: Math.hypot(dx, dy),
        angle: Math.atan2(dy, dx),
        color: laneColor(edge.color),
      };
    }),
  );

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: 0, width, height, overflow: "hidden" }}
    >
      {segments.map(({ key, segment, length, angle }) => (
        <View
          key={`${key}:shadow`}
          style={{
            position: "absolute",
            left: (segment.x1 + segment.x2) / 2 - length / 2 - 3,
            top: (segment.y1 + segment.y2) / 2 - LINE_WIDTH / 2 - 1,
            width: length + 8,
            height: LINE_WIDTH + 2,
            backgroundColor: theme.colors.surface0,
            transform: [{ rotate: `${angle}rad` }],
          }}
        />
      ))}
      {segments.map(({ key, segment, length, angle, color }) => (
        <View
          key={`${key}:line`}
          style={{
            position: "absolute",
            left: (segment.x1 + segment.x2) / 2 - length / 2 - 2,
            top: (segment.y1 + segment.y2) / 2 - LINE_WIDTH / 2,
            width: length + 4,
            height: LINE_WIDTH,
            backgroundColor: color,
            transform: [{ rotate: `${angle}rad` }],
          }}
        />
      ))}
      <View
        style={{
          position: "absolute",
          left: nodeX - NODE_RADIUS,
          top: centerY - NODE_RADIUS,
          width: NODE_RADIUS * 2,
          height: NODE_RADIUS * 2,
          borderRadius: NODE_RADIUS,
          backgroundColor: nodeColor,
          borderWidth: 1,
          borderColor: theme.colors.surface0,
        }}
      />
    </View>
  );
}

export function GraphDetailLane({
  row,
  width,
  theme,
}: {
  row: GitRow;
  width: number;
  theme: PluginWorkspacePanelProps["theme"];
}) {
  const lanes = new Map<number, string>();
  lanes.set(row.lane, laneColor(row.color));
  for (const edge of row.edges) {
    lanes.set(edge.from, laneColor(edge.color));
    lanes.set(edge.to, laneColor(edge.color));
  }

  return (
    <View style={{ flex: 1, width, overflow: "hidden" }}>
      {[...lanes].map(([lane, laneColor]) => (
        <View
          key={lane}
          style={{
            position: "absolute",
            left: laneX(lane) - 1,
            top: 0,
            bottom: 0,
            width: 2,
            borderRadius: 2,
            backgroundColor: laneColor,
            opacity: 0.85,
          }}
        />
      ))}
    </View>
  );
}
