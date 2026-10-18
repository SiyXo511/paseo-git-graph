export const LANE_STEP = 16;
export const LANE_PAD = 16;

export function laneX(lane: number): number {
  return LANE_PAD + lane * LANE_STEP;
}

export type CurveSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type Point = { x: number; y: number };

export function edgeSegment(
  edge: { from: number; to: number; fromTop: boolean },
  height: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const centerY = height / 2;
  return edge.fromTop
    ? { x1: laneX(edge.from), y1: 0, x2: laneX(edge.to), y2: centerY }
    : { x1: laneX(edge.from), y1: centerY, x2: laneX(edge.to), y2: height };
}

function blend(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function cubicPoint(
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
  t: number,
): Point {
  const first = {
    x: blend(start.x, control1.x, t),
    y: blend(start.y, control1.y, t),
  };
  const second = {
    x: blend(control1.x, control2.x, t),
    y: blend(control1.y, control2.y, t),
  };
  const third = {
    x: blend(control2.x, end.x, t),
    y: blend(control2.y, end.y, t),
  };
  const lower = {
    x: blend(first.x, second.x, t),
    y: blend(first.y, second.y, t),
  };
  const upper = {
    x: blend(second.x, third.x, t),
    y: blend(second.y, third.y, t),
  };
  return {
    x: blend(lower.x, upper.x, t),
    y: blend(lower.y, upper.y, t),
  };
}

function sampleCurve(
  start: Point,
  end: Point,
  from: number,
  to: number,
  steps: number,
): CurveSegment[] {
  const rise = end.y - start.y;
  // Vertical handles at both ends keep the curve joined to the next row.
  // Placing them most of the way across the rise gives the tight rounded
  // turn used by desktop Git clients.
  const control1 = { x: start.x, y: start.y + rise * 0.8 };
  const control2 = { x: end.x, y: end.y - rise * 0.8 };
  const segments: CurveSegment[] = [];
  let previous = cubicPoint(start, control1, control2, end, from);
  for (let index = 1; index <= steps; index += 1) {
    const next = cubicPoint(
      start,
      control1,
      control2,
      end,
      from + ((to - from) * index) / steps,
    );
    segments.push({ x1: previous.x, y1: previous.y, x2: next.x, y2: next.y });
    previous = next;
  }
  return segments;
}

/**
 * Returns the half of a lane change that falls inside one row.
 *
 * Incoming edges end at the node and outgoing edges start at it. The next
 * row repeats the same centre-to-centre curve with `fromTop`, so both halves
 * compose one continuous path across the row boundary.
 */
export function edgeCurveSegments(
  edge: { from: number; to: number; fromTop: boolean },
  height: number,
  steps = 10,
): CurveSegment[] {
  const fromX = laneX(edge.from);
  const toX = laneX(edge.to);
  const center = height / 2;
  if (fromX === toX) {
    return [
      edge.fromTop
        ? { x1: fromX, y1: 0, x2: toX, y2: center }
        : { x1: fromX, y1: center, x2: toX, y2: height },
    ];
  }
  return edge.fromTop
    ? sampleCurve({ x: fromX, y: -center }, { x: toX, y: center }, 0.5, 1, steps)
    : sampleCurve({ x: fromX, y: center }, { x: toX, y: center + height }, 0, 0.5, steps);
}
