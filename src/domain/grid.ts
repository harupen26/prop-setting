import type { Marker, Phase } from "../types";

export const FIELD_METERS = {
  width: 50,
  height: 40,
  centerWidth: 30,
  centerHeight: 30,
  sideMargin: 10,
  frontBackMargin: 5
};

export const SNAP = {
  meters: 0.3125,
  xMax: 160,
  yMax: 128,
  fineStep: 2,
  majorStep: 16
};

const GUIDE_FINE_CELLS = {
  topOffset: 4,
  sideOffset: 10
};

export const DRILL_GUIDES = {
  center: {
    x: 32,
    y: 0,
    width: 96,
    height: 96
  },
  green: {
    x: 32 - GUIDE_FINE_CELLS.sideOffset * SNAP.fineStep,
    y: GUIDE_FINE_CELLS.topOffset * SNAP.fineStep,
    width: 96 + GUIDE_FINE_CELLS.sideOffset * SNAP.fineStep * 2,
    height: 96
  },
  cross: {
    x: 80,
    y: 48
  },
  tickArm: 2
};

export type CanvasSize = {
  width: number;
  height: number;
};

export type SnapPoint = {
  xSnap: number;
  ySnap: number;
};

export type OverlapInfo = {
  index: number;
  count: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function coordinateToSnap(x: number, y: number, size: CanvasSize): SnapPoint {
  return {
    xSnap: clamp(Math.round((x / size.width) * SNAP.xMax), 0, SNAP.xMax),
    ySnap: clamp(Math.round((y / size.height) * SNAP.yMax), 0, SNAP.yMax)
  };
}

export function snapToCoordinate(point: SnapPoint, size: CanvasSize): { x: number; y: number } {
  return {
    x: (point.xSnap / SNAP.xMax) * size.width,
    y: (point.ySnap / SNAP.yMax) * size.height
  };
}

export function getPhaseLabel(phase: Phase): string {
  return phase === "entry" ? "入場" : "退場";
}

export function buildOverlapMap(markers: Marker[]): Record<string, OverlapInfo> {
  const grouped = new Map<string, Marker[]>();

  for (const marker of markers) {
    const key = `${marker.phase}:${marker.xSnap}:${marker.ySnap}`;
    const list = grouped.get(key) ?? [];
    list.push(marker);
    grouped.set(key, list);
  }

  const result: Record<string, OverlapInfo> = {};

  grouped.forEach((list) => {
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    sorted.forEach((marker, index) => {
      result[marker.id] = { index, count: sorted.length };
    });
  });

  return result;
}

export function getOverlapOffset(
  point: SnapPoint,
  overlap: OverlapInfo | undefined,
  radiusPx: number
): { dx: number; dy: number } {
  if (!overlap || overlap.count <= 1 || overlap.index === 0) {
    return { dx: 0, dy: 0 };
  }

  const vectorX = point.xSnap - SNAP.xMax / 2;
  const vectorY = point.ySnap - SNAP.yMax / 2;
  const length = Math.hypot(vectorX, vectorY) || 1;
  const unitX = length < 1 ? 0 : vectorX / length;
  const unitY = length < 1 ? -1 : vectorY / length;
  const distance = overlap.index * radiusPx * 1.35;

  return {
    dx: unitX * distance,
    dy: unitY * distance
  };
}

export function getCenterRectSnapBounds(): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return DRILL_GUIDES.center;
}

export function snapXToCanvas(xSnap: number, width: number): number {
  return (xSnap / SNAP.xMax) * width;
}

export function snapYToCanvas(ySnap: number, height: number): number {
  return (ySnap / SNAP.yMax) * height;
}

export function snapRectToCanvas(
  rect: { x: number; y: number; width: number; height: number },
  size: CanvasSize
): { x: number; y: number; width: number; height: number } {
  return {
    x: snapXToCanvas(rect.x, size.width),
    y: snapYToCanvas(rect.y, size.height),
    width: snapXToCanvas(rect.width, size.width),
    height: snapYToCanvas(rect.height, size.height)
  };
}
