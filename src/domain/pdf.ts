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
import { getActiveCompetition, getParticipantById, getRoleById, isRoleVisible } from "../selectors";

const SVG_WIDTH = 520;
const SVG_HEIGHT = 416;
const DRILL_WIDTH = 500;
const DRILL_HEIGHT = 400;
const MARKER_RADIUS = 4.8;

export function buildPdfHtml(state: AppState): string {
  const competition = getActiveCompetition(state);
  const entrySvg = buildPhaseSvg(state, "entry");
  const exitSvg = buildPhaseSvg(state, "exit");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 portrait; margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif;
      color: #111827;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .meta {
      font-size: 10px;
      color: #64748b;
      text-align: right;
      line-height: 1.6;
    }
    .sheet {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 84px;
      column-gap: 10px;
      align-items: start;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid #d1d5db;
    }
    .sheet:last-child { border-bottom: 0; margin-bottom: 0; }
    .phase-title {
      font-size: 14px;
      font-weight: 700;
      margin: 0 0 4px 0;
    }
    .legend-title {
      font-size: 9px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .legend-row {
      display: grid;
      grid-template-columns: 1fr 10px;
      gap: 4px;
      align-items: center;
      min-height: 16px;
      font-size: 8px;
      line-height: 1.15;
      margin-bottom: 3px;
      word-break: keep-all;
    }
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      border: 1px solid rgba(17, 24, 39, 0.18);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>手具セット管理</h1>
    <div class="meta">
      <div>${escapeHtml(competition?.name ?? "大会未設定")}</div>
      <div>${escapeHtml(new Date().toLocaleDateString("ja-JP"))}</div>
    </div>
  </div>
  ${buildSheetBlock("入場", entrySvg, buildLegendHtml(state))}
  ${buildSheetBlock("退場", exitSvg, buildLegendHtml(state))}
</body>
</html>`;
}

function buildSheetBlock(title: string, svg: string, legend: string): string {
  return `<section class="sheet">
    <div>
      <div class="phase-title">${title}</div>
      ${svg}
    </div>
    <aside>
      <div class="legend-title">【凡例】</div>
      ${legend}
    </aside>
  </section>`;
}

function buildPhaseSvg(state: AppState, phase: Phase): string {
  const integratedIds = state.integratedParticipantIdsByCompetition[state.activeCompetitionId] ?? [];
  const participantIds = integratedIds.length
    ? integratedIds
    : state.participants.map((participant) => participant.id);
  const markers = state.markers.filter(
    (marker) =>
      marker.competitionId === state.activeCompetitionId &&
      marker.phase === phase &&
      participantIds.includes(marker.participantId) &&
      isRoleVisible(state, marker.roleId)
  );
  const overlap = buildOverlapMap(markers);
  const gridLines = buildGridLines();
  const markerNodes = markers
    .map((marker) => buildMarkerNode(state, marker, overlap[marker.id]))
    .join("");

  return `<svg viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" width="100%" height="248" role="img" aria-label="${getPhaseLabel(
    phase
  )}のドリル">
    <text x="${DRILL_WIDTH / 2}" y="18" text-anchor="middle" font-size="18" font-weight="700">前</text>
    <g transform="translate(10, 24)">
      ${gridLines}
      ${markerNodes}
    </g>
    <text x="${DRILL_WIDTH / 2}" y="${SVG_HEIGHT - 3}" text-anchor="middle" font-size="18" font-weight="700">後</text>
  </svg>`;
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
  const offset = getOverlapOffset(marker, overlap, MARKER_RADIUS);
  const x = base.x + offset.dx;
  const y = base.y + offset.dy;
  const lines = formatMarkerLabel(participant.markerLabel);
  const textColor = getReadableTextColor(role.color);
  const textNodes = lines
    .map((line, index) => {
      const dy = lines.length === 1 ? 1.5 : index === 0 ? -0.5 : 4.5;
      return `<text x="${x}" y="${y + dy}" text-anchor="middle" font-size="4.2" font-weight="700" fill="${textColor}">${escapeHtml(
        line
      )}</text>`;
    })
    .join("");

  return `<g>
    <circle cx="${x}" cy="${y}" r="${MARKER_RADIUS}" fill="${role.color}" stroke="#ffffff" stroke-width="1.2" />
    ${textNodes}
  </g>`;
}

function buildLegendHtml(state: AppState): string {
  return state.roles
    .filter((role) => isRoleVisible(state, role.id))
    .sort((a, b) => a.order - b.order)
    .map(
      (role) => `<div class="legend-row">
        <span>${escapeHtml(role.name)}</span>
        <span class="dot" style="background:${role.color}"></span>
      </div>`
    )
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
