import { expect, it } from "vitest";
import { edgeCurveSegments, edgeSegment, laneX } from "../client/graph-geometry";

it("ends converging top edges at the commit center and continuation edges at the row bottom", () => {
  const converging = edgeSegment({ from: 2, to: 0, fromTop: true }, 26);
  expect(converging).toEqual({ x1: 48, y1: 0, x2: 16, y2: 13 });

  const continuing = edgeSegment({ from: 0, to: 2, fromTop: false }, 26);
  expect(continuing).toEqual({ x1: 16, y1: 13, x2: 48, y2: 26 });
});

it("uses a readable lane pitch", () => {
  expect(laneX(0)).toBe(16);
  expect(laneX(1) - laneX(0)).toBe(16);
  expect(laneX(4) - laneX(0)).toBe(64);
});

it("draws the matching halves of the source Git Graph cubic", () => {
  const top = edgeCurveSegments({ from: 0, to: 2, fromTop: true }, 24, 4);
  const bottom = edgeCurveSegments({ from: 0, to: 2, fromTop: false }, 24, 4);

  expect(top[0]).toMatchObject({ x1: 32, y1: 0 });
  expect(top.at(-1)).toMatchObject({ x2: 48, y2: 12 });
  expect(bottom[0]).toMatchObject({ x1: 16, y1: 12 });
  expect(bottom.at(-1)).toMatchObject({ x2: 32, y2: 24 });
  for (const segments of [top, bottom]) {
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index].x1).toBe(segments[index - 1].x2);
      expect(segments[index].y1).toBe(segments[index - 1].y2);
    }
  }
});
