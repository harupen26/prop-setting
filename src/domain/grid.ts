import type { ApparatusRole, Marker, Phase, RoleFolder } from "../types";

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

export type OverlapSortContext = {
  folders?: RoleFolder[];
  roles?: ApparatusRole[];
};

export type OverlapStepPx = {
  x: number;
  y: number;
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

export function buildOverlapMap(
  markers: Marker[],
  sortContext: OverlapSortContext = {}
): Record<string, OverlapInfo> {
  const grouped = new Map<string, Marker[]>();
  const roleOrderMap = buildRoleOrderMap(sortContext);
  const markerOrderMap = new Map(markers.map((marker, index) => [marker.id, index]));

  for (const marker of markers) {
    const key = `${marker.phase}:${marker.xSnap}:${marker.ySnap}`;
    const list = grouped.get(key) ?? [];
    list.push(marker);
    grouped.set(key, list);
  }

  const result: Record<string, OverlapInfo> = {};

  grouped.forEach((list) => {
    const sorted = [...list].sort((a, b) =>
      compareOverlapMarkers(a, b, roleOrderMap, markerOrderMap)
    );
    sorted.forEach((marker, index) => {
      result[marker.id] = { index, count: sorted.length };
    });
  });

  return result;
}

export function getOverlapOffset(
  point: SnapPoint,
  overlap: OverlapInfo | undefined,
  stepPx: OverlapStepPx
): { dx: number; dy: number } {
  if (!overlap || overlap.count <= 1 || overlap.index === 0) {
    return { dx: 0, dy: 0 };
  }

  const vectorX = point.xSnap - SNAP.xMax / 2;
  const vectorY = point.ySnap - SNAP.yMax / 2;
  const moveHorizontally = Math.abs(vectorX) > Math.abs(vectorY);

  if (moveHorizontally) {
    return {
      dx: (vectorX > 0 ? 1 : -1) * overlap.index * stepPx.x,
      dy: 0
    };
  }

  return {
    dx: 0,
    dy: (vectorY > 0 ? 1 : -1) * overlap.index * stepPx.y
  };
}

function buildRoleOrderMap(sortContext: OverlapSortContext): Map<string, number> {
  const folderOrder = new Map(
    (sortContext.folders ?? []).map((folder, index) => [folder.id, folder.order * 1000 + index])
  );
  const roles = [...(sortContext.roles ?? [])].sort((a, b) => {
    const folderA = folderOrder.get(a.folderId) ?? Number.MAX_SAFE_INTEGER;
    const folderB = folderOrder.get(b.folderId) ?? Number.MAX_SAFE_INTEGER;

    if (folderA !== folderB) {
      return folderA - folderB;
    }

    if (a.order !== b.order) {
      return a.order - b.order;
    }

    const nameCompare = a.name.localeCompare(b.name);
    return nameCompare || a.id.localeCompare(b.id);
  });

  return new Map(roles.map((role, index) => [role.id, index]));
}

function compareOverlapMarkers(
  a: Marker,
  b: Marker,
  roleOrderMap: Map<string, number>,
  markerOrderMap: Map<string, number>
): number {
  const roleOrderA = roleOrderMap.get(a.roleId) ?? Number.MAX_SAFE_INTEGER;
  const roleOrderB = roleOrderMap.get(b.roleId) ?? Number.MAX_SAFE_INTEGER;

  if (roleOrderA !== roleOrderB) {
    return roleOrderA - roleOrderB;
  }

  return (markerOrderMap.get(a.id) ?? 0) - (markerOrderMap.get(b.id) ?? 0);
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
