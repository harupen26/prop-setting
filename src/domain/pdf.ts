import type { AppState, Marker, Phase } from "../types";
import {
  DRILL_GUIDES,
  SNAP,
  buildOverlapMap,
  getOverlapOffset,
  getPhaseLabel,
  snapRectToCanvas,
  snapToCoordinate
} from "./grid";
import { formatMarkerLabel, getReadableTextColor } from "./labels";
import { getParticipantById, getRoleById, isRoleVisible } from "../selectors";

const SVG_WIDTH = 520;
const SVG_HEIGHT = 416;
const DRILL_WIDTH = 500;
const DRILL_HEIGHT = 400;
const MARKER_RADIUS = 4.4;

export type PdfTargetMode = "master" | "participant";
export type PdfPhaseOption = "entry" | "exit" | "both";

export type PdfExportOptions = {
  targetMode: PdfTargetMode;
  participantId?: string;
  phaseOption: PdfPhaseOption;
};

export const defaultPdfExportOptions: PdfExportOptions = {
  targetMode: "master",
  phaseOption: "both"
};

export function buildPdfHtml(
  state: AppState,
  options: PdfExportOptions = defaultPdfExportOptions
): string {
  const sheets = getPdfPhases(options)
    .map((phase) => buildSheetBlock(buildDrillSheetSvg(state, phase, options)))
    .join("");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 landscape; margin: 6mm; }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif;
      color: #111827;
      background: #ffffff;
    }
    .sheet {
      page-break-after: always;
      height: 198mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .sheet:last-child { page-break-after: auto; }
    .drill-svg {
      width: 247mm;
      height: 197.6mm;
      display: block;
    }
  </style>
</head>
<body>
  ${sheets}
</body>
</html>`;
}

function buildSheetBlock(svg: string): string {
  return `<section class="sheet">
    ${svg}
  </section>`;
}

export function buildDrillSheetSvg(
  state: AppState,
  phase: Phase,
  options: PdfExportOptions = defaultPdfExportOptions
): string {
  const participantIds = getPdfParticipantIds(state, options);
  const targetLabel = getPdfTargetLabel(state, options);
  const markers = state.markers.filter(
    (marker) =>
      marker.competitionId === state.activeCompetitionId &&
      marker.phase === phase &&
      participantIds.includes(marker.participantId) &&
      isRoleVisible(state, marker.roleId)
  );
  const overlap = buildOverlapMap(markers, { folders: state.folders, roles: state.roles });
  const gridLines = buildGridLines();
  const markerNodes = markers
    .map((marker) => buildMarkerNode(state, marker, overlap[marker.id]))
    .join("");

  return `<svg class="drill-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" role="img" aria-label="${getPhaseLabel(
    phase
  )}のドリル" font-family="-apple-system, BlinkMacSystemFont, Hiragino Sans, Yu Gothic, sans-serif">
    <rect x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#ffffff" />
    <text x="10" y="18" font-size="13" font-weight="700" fill="#111827">${getPhaseLabel(phase)}</text>
    <text x="${SVG_WIDTH - 10}" y="18" text-anchor="end" font-size="10" font-weight="700" fill="#64748b">${escapeHtml(
      targetLabel
    )}</text>
    <text x="${DRILL_WIDTH / 2}" y="18" text-anchor="middle" font-size="18" font-weight="700">前</text>
    <g transform="translate(10, 24)">
      ${gridLines}
      ${markerNodes}
    </g>
    <text x="${DRILL_WIDTH / 2}" y="${SVG_HEIGHT - 3}" text-anchor="middle" font-size="18" font-weight="700">後</text>
  </svg>`;
}

export function getPdfPhases(options: PdfExportOptions): Phase[] {
  if (options.phaseOption === "entry") {
    return ["entry"];
  }

  if (options.phaseOption === "exit") {
    return ["exit"];
  }

  return ["entry", "exit"];
}

export function getPdfTargetLabel(state: AppState, options: PdfExportOptions): string {
  if (options.targetMode === "participant" && options.participantId) {
    return getParticipantById(state, options.participantId)?.name ?? "参加者";
  }

  return "統合表示";
}

function getPdfParticipantIds(state: AppState, options: PdfExportOptions): string[] {
  if (options.targetMode === "participant" && options.participantId) {
    return [options.participantId];
  }

  return state.participants.map((participant) => participant.id);
}

function buildGridLines(): string {
  const lines: string[] = [];
  const size = { width: DRILL_WIDTH, height: DRILL_HEIGHT };
  const center = snapRectToCanvas(DRILL_GUIDES.center, size);
  const green = snapRectToCanvas(DRILL_GUIDES.green, size);
  const centerLineX = (DRILL_GUIDES.cross.x / SNAP.xMax) * DRILL_WIDTH;
  const centerLineY = (DRILL_GUIDES.cross.y / SNAP.yMax) * DRILL_HEIGHT;

  for (let snap = 0; snap <= SNAP.xMax; snap += SNAP.fineStep) {
    const x = (snap / SNAP.xMax) * DRILL_WIDTH;
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${DRILL_HEIGHT}" stroke="#bfdbfe" stroke-width="0.35" />`
    );
  }

  for (let snap = 0; snap <= SNAP.yMax; snap += SNAP.fineStep) {
    const y = (snap / SNAP.yMax) * DRILL_HEIGHT;
    lines.push(
      `<line x1="0" y1="${y}" x2="${DRILL_WIDTH}" y2="${y}" stroke="#bfdbfe" stroke-width="0.35" />`
    );
  }

  lines.push(
    `<rect x="${green.x}" y="${green.y}" width="${green.width}" height="${green.height}" fill="none" stroke="#74d99f" stroke-opacity="0.82" stroke-width="1.1" />`
  );
  lines.push(
    `<rect x="${center.x}" y="${center.y}" width="${center.width}" height="${center.height}" fill="none" stroke="#111827" stroke-width="1.2" />`
  );
  lines.push(
    `<line x1="${centerLineX}" y1="${center.y}" x2="${centerLineX}" y2="${
      center.y + center.height
    }" stroke="#111827" stroke-width="1" />`
  );
  lines.push(
    `<line x1="${green.x}" y1="${centerLineY}" x2="${green.x + green.width}" y2="${centerLineY}" stroke="#111827" stroke-width="1" />`
  );

  for (let xSnap = SNAP.majorStep; xSnap < SNAP.xMax; xSnap += SNAP.majorStep) {
    for (
      let ySnap = DRILL_GUIDES.center.y;
      ySnap <= DRILL_GUIDES.center.y + DRILL_GUIDES.center.height;
      ySnap += SNAP.majorStep
    ) {
      lines.push(...buildFiveMeterMarkLines(xSnap, ySnap));
    }
  }

  return lines.join("");
}

function buildFiveMeterMarkLines(xSnap: number, ySnap: number): string[] {
  const arm = DRILL_GUIDES.tickArm;
  const center = DRILL_GUIDES.center;
  const x = (xSnap / SNAP.xMax) * DRILL_WIDTH;
  const y = (ySnap / SNAP.yMax) * DRILL_HEIGHT;
  const leftLimit = xSnap === center.x ? xSnap : xSnap - arm;
  const rightLimit = xSnap === center.x + center.width ? xSnap : xSnap + arm;
  const topLimit = ySnap === center.y ? ySnap : ySnap - arm;
  const bottomLimit = ySnap === center.y + center.height ? ySnap : ySnap + arm;
  const lines: string[] = [];

  if (leftLimit !== rightLimit) {
    lines.push(
      `<line x1="${(leftLimit / SNAP.xMax) * DRILL_WIDTH}" y1="${y}" x2="${
        (rightLimit / SNAP.xMax) * DRILL_WIDTH
      }" y2="${y}" stroke="#111827" stroke-width="0.85" />`
    );
  }

  if (topLimit !== bottomLimit) {
    lines.push(
      `<line x1="${x}" y1="${(topLimit / SNAP.yMax) * DRILL_HEIGHT}" x2="${x}" y2="${
        (bottomLimit / SNAP.yMax) * DRILL_HEIGHT
      }" stroke="#111827" stroke-width="0.85" />`
    );
  }

  return lines;
}

function buildMarkerNode(
  state: AppState,
  marker: Marker,
  overlap?: { index: number; count: number }
): string {
  const role = getRoleById(state, marker.roleId);
  const participant = getParticipantById(state, marker.participantId);
  if (!role || !participant) {
    return "";
  }

  const base = snapToCoordinate(marker, { width: DRILL_WIDTH, height: DRILL_HEIGHT });
  const offset = getOverlapOffset(marker, overlap, {
    x: DRILL_WIDTH / SNAP.xMax,
    y: DRILL_HEIGHT / SNAP.yMax
  });
  const x = base.x + offset.dx;
  const y = base.y + offset.dy;
  const lines = formatMarkerLabel(participant.markerLabel);
  const textColor = getReadableTextColor(role.color);
  const textNodes = lines
    .map((line, index) => {
      const { fontSize, yOffset } = getPdfMarkerTextMetrics(lines, index);
      return `<text x="${x}" y="${y + yOffset}" text-anchor="middle" font-size="${fontSize}" font-weight="700" fill="${textColor}">${escapeHtml(
        line
      )}</text>`;
    })
    .join("");

  return `<g>
    <circle cx="${x}" cy="${y}" r="${MARKER_RADIUS}" fill="${role.color}" />
    ${textNodes}
  </g>`;
}

function getPdfMarkerTextMetrics(labelLines: string[], index: number) {
  const maxLength = Math.max(...labelLines.map((line) => Array.from(line).length), 1);

  if (labelLines.length === 1) {
    if (maxLength >= 3) {
      return { fontSize: 2.25, yOffset: 0.8 };
    }

    if (maxLength === 2) {
      return { fontSize: 2.85, yOffset: 0.95 };
    }

    return { fontSize: 3.15, yOffset: 1.05 };
  }

  return {
    fontSize: 2.5,
    yOffset: index === 0 ? -0.9 : 2.2
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
