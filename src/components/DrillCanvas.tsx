import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";

import type { ApparatusRole, Marker, Participant, Phase } from "../types";
import {
  DRILL_GUIDES,
  SNAP,
  buildOverlapMap,
  coordinateToSnap,
  getOverlapOffset,
  snapRectToCanvas,
  snapToCoordinate,
  snapXToCanvas,
  snapYToCanvas
} from "../domain/grid";
import { formatMarkerLabel, getReadableTextColor } from "../domain/labels";
import { colors, radius } from "../theme";

type MarkerView = {
  marker: Marker;
  x: number;
  y: number;
};

type DragPreview = {
  marker: Marker;
  x: number;
  y: number;
};

type Props = {
  phase: Phase;
  markers: Marker[];
  roles: ApparatusRole[];
  participants: Participant[];
  selectedMarkerId?: string;
  onPlace: (xSnap: number, ySnap: number) => void;
  onMove: (markerId: string, xSnap: number, ySnap: number) => void;
  onSelect: (markerId?: string) => void;
};

const MARKER_RADIUS = 6;
const HIT_RADIUS = 22;
const PREVIEW_RADIUS = 24;

export function DrillCanvas({
  phase,
  markers,
  roles,
  participants,
  selectedMarkerId,
  onPlace,
  onMove,
  onSelect
}: Props) {
  const [width, setWidth] = useState(340);
  const height = width * 0.8;
  const size = useMemo(() => ({ width, height }), [height, width]);
  const overlap = useMemo(() => buildOverlapMap(markers), [markers]);
  const markerViews = useMemo(
    () =>
      markers.map((marker) => {
        const base = snapToCoordinate(marker, size);
        const offset = getOverlapOffset(marker, overlap[marker.id], MARKER_RADIUS);
        return {
          marker,
          x: base.x + offset.dx,
          y: base.y + offset.dy
        };
      }),
    [markers, overlap, size]
  );
  const markerViewsRef = useRef<MarkerView[]>(markerViews);
  const sizeRef = useRef(size);
  const callbacksRef = useRef({ onPlace, onMove, onSelect });
  const [dragPreview, setDragPreview] = useState<DragPreview | undefined>();
  const dragRef = useRef<{ markerId?: string; startX: number; startY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    moved: false
  });

  useEffect(() => {
    markerViewsRef.current = markerViews;
  }, [markerViews]);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    callbacksRef.current = { onPlace, onMove, onSelect };
  }, [onMove, onPlace, onSelect]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        const hit = findNearestMarker(locationX, locationY, markerViewsRef.current);
        dragRef.current = {
          markerId: hit?.marker.id,
          startX: locationX,
          startY: locationY,
          moved: false
        };
        callbacksRef.current.onSelect(hit?.marker.id);
      },
      onPanResponderMove: (event) => {
        const drag = dragRef.current;
        if (!drag.markerId) {
          return;
        }

        const { locationX, locationY } = event.nativeEvent;
        const distance = Math.hypot(locationX - drag.startX, locationY - drag.startY);
        if (distance > 2) {
          drag.moved = true;
          const previewMarker = markerViewsRef.current.find(
            (markerView) => markerView.marker.id === drag.markerId
          )?.marker;
          if (previewMarker) {
            setDragPreview({ marker: previewMarker, x: locationX, y: locationY });
          }
        }

        const next = coordinateToSnap(locationX, locationY, sizeRef.current);
        callbacksRef.current.onMove(drag.markerId, next.xSnap, next.ySnap);
      },
      onPanResponderRelease: (event) => {
        const drag = dragRef.current;
        const { locationX, locationY } = event.nativeEvent;
        const distance = Math.hypot(locationX - drag.startX, locationY - drag.startY);

        if (!drag.markerId && distance < 6) {
          const point = coordinateToSnap(locationX, locationY, sizeRef.current);
          callbacksRef.current.onPlace(point.xSnap, point.ySnap);
        }

        setDragPreview(undefined);
        dragRef.current = { startX: 0, startY: 0, moved: false };
      }
    })
  ).current;

  const dragPreviewRole = dragPreview
    ? roles.find((role) => role.id === dragPreview.marker.roleId)
    : undefined;
  const dragPreviewParticipant = dragPreview
    ? participants.find((participant) => participant.id === dragPreview.marker.participantId)
    : undefined;

  return (
    <View style={styles.shell}>
      <View style={styles.directionRow}>
        <Text style={styles.directionText}>前</Text>
      </View>
      <View
        {...responder.panHandlers}
        onLayout={(event) => {
          const nextWidth = Math.max(280, event.nativeEvent.layout.width);
          setWidth(nextWidth);
        }}
        style={[styles.canvas, { height }]}
      >
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Rect x={0} y={0} width={width} height={height} fill="#ffffff" />
          {buildGrid(width, height)}
          {markerViews.map(({ marker, x, y }) => {
            const role = roles.find((item) => item.id === marker.roleId);
            const participant = participants.find((item) => item.id === marker.participantId);
            if (!role || !participant) {
              return null;
            }

            const labelLines = formatMarkerLabel(participant.markerLabel);
            const textColor = getReadableTextColor(role.color);
            const selected = marker.id === selectedMarkerId;

            return (
              <G key={marker.id} pointerEvents="none">
                <Circle
                  cx={x}
                  cy={y}
                  r={MARKER_RADIUS}
                  fill={role.color}
                  stroke={selected ? colors.text : "#ffffff"}
                  strokeWidth={selected ? 2.5 : 1.6}
                />
                {labelLines.map((line, index) => {
                  const yOffset = labelLines.length === 1 ? 4 : index === 0 ? -1 : 8;
                  return (
                    <SvgText
                      key={`${marker.id}-${line}-${index}`}
                      x={x}
                      y={y + yOffset}
                      pointerEvents="none"
                      textAnchor="middle"
                      fontSize={labelLines.length === 1 ? 8 : 7}
                      fontWeight="700"
                      fill={textColor}
                    >
                      {line}
                    </SvgText>
                  );
                })}
              </G>
            );
          })}
        </Svg>
        {dragPreview && dragPreviewRole && dragPreviewParticipant ? (
          <View
            pointerEvents="none"
            style={[
              styles.dragPreview,
              {
                left: clampPreviewLeft(dragPreview.x + 14, width),
                top: clampPreviewTop(dragPreview.y - 68, height)
              }
            ]}
          >
            <View
              style={[
                styles.dragPreviewCircle,
                {
                  backgroundColor: dragPreviewRole.color,
                  borderRadius: PREVIEW_RADIUS
                }
              ]}
            >
              {formatMarkerLabel(dragPreviewParticipant.markerLabel).map((line) => (
                <Text
                  key={line}
                  style={[
                    styles.dragPreviewText,
                    { color: getReadableTextColor(dragPreviewRole.color) }
                  ]}
                >
                  {line}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
      </View>
      <View style={styles.directionRow}>
        <Text style={styles.directionText}>後</Text>
        <Text style={styles.phaseText}>{phase === "entry" ? "入場" : "退場"}</Text>
      </View>
    </View>
  );
}

function buildGrid(width: number, height: number) {
  const elements = [];
  const size = { width, height };
  const center = snapRectToCanvas(DRILL_GUIDES.center, size);
  const green = snapRectToCanvas(DRILL_GUIDES.green, size);
  const centerLineX = snapXToCanvas(DRILL_GUIDES.cross.x, width);
  const centerLineY = snapYToCanvas(DRILL_GUIDES.cross.y, height);

  for (let snap = 0; snap <= SNAP.xMax; snap += SNAP.fineStep) {
    const x = snapXToCanvas(snap, width);
    elements.push(
      <Line
        key={`fine-x-${snap}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={colors.gridFine}
        strokeWidth={0.55}
      />
    );
  }

  for (let snap = 0; snap <= SNAP.yMax; snap += SNAP.fineStep) {
    const y = snapYToCanvas(snap, height);
    elements.push(
      <Line
        key={`fine-y-${snap}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={colors.gridFine}
        strokeWidth={0.55}
      />
    );
  }

  elements.push(
    <Rect
      key="green-guide"
      x={green.x}
      y={green.y}
      width={green.width}
      height={green.height}
      fill="none"
      stroke={colors.field}
      strokeOpacity={0.82}
      strokeWidth={2}
    />
  );

  elements.push(
    <Rect
      key="center-border"
      x={center.x}
      y={center.y}
      width={center.width}
      height={center.height}
      fill="none"
      stroke={colors.gridMajor}
      strokeWidth={2}
    />
  );
  elements.push(
    <Line
      key="center-vertical"
      x1={centerLineX}
      y1={center.y}
      x2={centerLineX}
      y2={center.y + center.height}
      stroke={colors.gridMajor}
      strokeWidth={1.65}
    />
  );
  elements.push(
    <Line
      key="center-horizontal"
      x1={green.x}
      y1={centerLineY}
      x2={green.x + green.width}
      y2={centerLineY}
      stroke={colors.gridMajor}
      strokeWidth={1.65}
    />
  );

  for (let xSnap = SNAP.majorStep; xSnap < SNAP.xMax; xSnap += SNAP.majorStep) {
    for (
      let ySnap = DRILL_GUIDES.center.y;
      ySnap <= DRILL_GUIDES.center.y + DRILL_GUIDES.center.height;
      ySnap += SNAP.majorStep
    ) {
      elements.push(...buildFiveMeterMark(xSnap, ySnap, width, height));
    }
  }

  return elements;
}

function buildFiveMeterMark(xSnap: number, ySnap: number, width: number, height: number) {
  const arm = DRILL_GUIDES.tickArm;
  const center = DRILL_GUIDES.center;
  const lines = [];
  const x = snapXToCanvas(xSnap, width);
  const y = snapYToCanvas(ySnap, height);
  const leftLimit = xSnap === center.x ? xSnap : xSnap - arm;
  const rightLimit = xSnap === center.x + center.width ? xSnap : xSnap + arm;
  const topLimit = ySnap === center.y ? ySnap : ySnap - arm;
  const bottomLimit = ySnap === center.y + center.height ? ySnap : ySnap + arm;

  if (leftLimit !== rightLimit) {
    lines.push(
      <Line
        key={`mark-h-${xSnap}-${ySnap}`}
        x1={snapXToCanvas(leftLimit, width)}
        y1={y}
        x2={snapXToCanvas(rightLimit, width)}
        y2={y}
        stroke={colors.gridMajor}
        strokeWidth={1.35}
      />
    );
  }

  if (topLimit !== bottomLimit) {
    lines.push(
      <Line
        key={`mark-v-${xSnap}-${ySnap}`}
        x1={x}
        y1={snapYToCanvas(topLimit, height)}
        x2={x}
        y2={snapYToCanvas(bottomLimit, height)}
        stroke={colors.gridMajor}
        strokeWidth={1.35}
      />
    );
  }

  return lines;
}

function findNearestMarker(x: number, y: number, markers: MarkerView[]): MarkerView | undefined {
  let nearest: MarkerView | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const markerView of markers) {
    const distance = Math.hypot(markerView.x - x, markerView.y - y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = markerView;
    }
  }

  return nearestDistance <= HIT_RADIUS ? nearest : undefined;
}

function clampPreviewLeft(left: number, width: number): number {
  return Math.min(Math.max(left, 8), Math.max(8, width - 56));
}

function clampPreviewTop(top: number, height: number): number {
  return Math.min(Math.max(top, 8), Math.max(8, height - 56));
}

const styles = StyleSheet.create({
  shell: {
    gap: 6
  },
  directionRow: {
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  directionText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  phaseText: {
    position: "absolute",
    left: 0,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  canvas: {
    width: "100%",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface
  },
  dragPreview: {
    position: "absolute",
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1,
    borderColor: colors.border
  },
  dragPreviewCircle: {
    width: PREVIEW_RADIUS * 2,
    height: PREVIEW_RADIUS * 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff"
  },
  dragPreviewText: {
    fontSize: 13,
    lineHeight: 14,
    fontWeight: "900"
  }
});
