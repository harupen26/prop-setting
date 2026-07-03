import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
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
import { GuideTarget } from "../guide/GuideOverlay";

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

type PinchGesture = {
  centerX: number;
  centerY: number;
  distance: number;
  panX: number;
  panY: number;
  zoom: number;
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
  onInteractionLockChange?: (locked: boolean) => void;
  onGuidePlace?: () => void;
  onGuideMove?: () => void;
  onGuideZoomButton?: () => void;
  onGuideZoomGesture?: () => void;
};

const HIT_RADIUS = 22;
const PREVIEW_RADIUS = 24;
const ZOOM_LEVELS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

export function DrillCanvas({
  phase,
  markers,
  roles,
  participants,
  selectedMarkerId,
  onPlace,
  onMove,
  onSelect,
  onInteractionLockChange,
  onGuidePlace,
  onGuideMove,
  onGuideZoomButton,
  onGuideZoomGesture
}: Props) {
  const [viewportWidth, setViewportWidth] = useState(340);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const height = viewportWidth * 0.8;
  const displayWidth = viewportWidth * zoom;
  const displayHeight = height * zoom;
  const markerRadius = getMarkerRadius(viewportWidth);
  const size = useMemo(() => ({ width: viewportWidth, height }), [height, viewportWidth]);
  const overlap = useMemo(() => buildOverlapMap(markers), [markers]);
  const markerViews = useMemo(
    () =>
      markers.map((marker) => {
        const base = snapToCoordinate(marker, size);
        const offset = getOverlapOffset(marker, overlap[marker.id], markerRadius);
        return {
          marker,
          x: base.x + offset.dx,
          y: base.y + offset.dy
        };
      }),
    [markerRadius, markers, overlap, size]
  );
  const markerViewsRef = useRef<MarkerView[]>(markerViews);
  const sizeRef = useRef(size);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const markerRadiusRef = useRef(markerRadius);
  const dimensionsRef = useRef({
    displayHeight,
    displayWidth,
    height,
    viewportWidth
  });
  const callbacksRef = useRef({
    onGuideMove,
    onGuidePlace,
    onGuideZoomButton,
    onGuideZoomGesture,
    onInteractionLockChange,
    onMove,
    onPlace,
    onSelect
  });
  const [dragPreview, setDragPreview] = useState<DragPreview | undefined>();
  const pinchRef = useRef<PinchGesture | undefined>(undefined);
  const dragRef = useRef<{
    markerId?: string;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    moved: boolean;
  }>({
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    moved: false
  });

  useEffect(() => {
    markerViewsRef.current = markerViews;
  }, [markerViews]);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    markerRadiusRef.current = markerRadius;
  }, [markerRadius]);

  useEffect(() => {
    dimensionsRef.current = {
      displayHeight,
      displayWidth,
      height,
      viewportWidth
    };
  }, [displayHeight, displayWidth, height, viewportWidth]);

  useEffect(() => {
    const next = clampPan(panRef.current, displayWidth, displayHeight, viewportWidth, height);
    panRef.current = next;
    setPan(next);
  }, [displayHeight, displayWidth, height, viewportWidth]);

  useEffect(() => {
    callbacksRef.current = {
      onGuideMove,
      onGuidePlace,
      onGuideZoomButton,
      onGuideZoomGesture,
      onInteractionLockChange,
      onMove,
      onPlace,
      onSelect
    };
  }, [
    onGuideMove,
    onGuidePlace,
    onGuideZoomButton,
    onGuideZoomGesture,
    onInteractionLockChange,
    onMove,
    onPlace,
    onSelect
  ]);

  function updateInteractionLock(locked: boolean) {
    callbacksRef.current.onInteractionLockChange?.(locked);
  }

  function changeZoom(direction: 1 | -1) {
    const currentIndex = ZOOM_LEVELS.indexOf(zoom);
    const fallbackIndex = ZOOM_LEVELS.findIndex((level) => level > zoom);
    const normalizedIndex = currentIndex >= 0 ? currentIndex : Math.max(0, fallbackIndex - 1);
    const nextIndex = Math.min(Math.max(normalizedIndex + direction, 0), ZOOM_LEVELS.length - 1);
    setZoom(ZOOM_LEVELS[nextIndex]);
    callbacksRef.current.onGuideZoomButton?.();
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        if (beginPinchGesture(event.nativeEvent.touches)) {
          return;
        }

        const { locationX, locationY } = event.nativeEvent;
        const point = viewportToCanvasPoint(locationX, locationY, panRef.current, zoomRef.current);
        const hit = findNearestMarker(
          point.x,
          point.y,
          markerViewsRef.current,
          getHitRadius(markerRadiusRef.current) / zoomRef.current
        );
        dragRef.current = {
          markerId: hit?.marker.id,
          startX: locationX,
          startY: locationY,
          startPanX: panRef.current.x,
          startPanY: panRef.current.y,
          moved: false
        };

        if (hit || zoomRef.current > 1) {
          updateInteractionLock(true);
        }

        callbacksRef.current.onSelect(hit?.marker.id);
      },
      onPanResponderMove: (event) => {
        if (event.nativeEvent.touches.length >= 2) {
          if (!pinchRef.current) {
            beginPinchGesture(event.nativeEvent.touches);
          }
          updatePinchGesture(event.nativeEvent.touches);
          return;
        }

        if (pinchRef.current) {
          return;
        }

        const drag = dragRef.current;
        const { locationX, locationY } = event.nativeEvent;
        const distance = Math.hypot(locationX - drag.startX, locationY - drag.startY);

        if (!drag.markerId) {
          if (zoomRef.current <= 1) {
            return;
          }

          if (distance > 2) {
            drag.moved = true;
          }

          const dimensions = dimensionsRef.current;
          const nextPan = clampPan(
            {
              x: drag.startPanX - (locationX - drag.startX),
              y: drag.startPanY - (locationY - drag.startY)
            },
            dimensions.displayWidth,
            dimensions.displayHeight,
            dimensions.viewportWidth,
            dimensions.height
          );
          panRef.current = nextPan;
          setPan(nextPan);
          return;
        }

        if (distance > 2) {
          drag.moved = true;
          const previewMarker = markerViewsRef.current.find(
            (markerView) => markerView.marker.id === drag.markerId
          )?.marker;
          if (previewMarker) {
            setDragPreview({ marker: previewMarker, x: locationX, y: locationY });
          }
        }

        const point = viewportToCanvasPoint(locationX, locationY, panRef.current, zoomRef.current);
        const next = coordinateToSnapWithStep(point.x, point.y, sizeRef.current);
        callbacksRef.current.onMove(drag.markerId, next.xSnap, next.ySnap);
        callbacksRef.current.onGuideMove?.();
      },
      onPanResponderRelease: (event) => {
        const drag = dragRef.current;
        const { locationX, locationY } = event.nativeEvent;
        const distance = Math.hypot(locationX - drag.startX, locationY - drag.startY);

        if (!drag.markerId && distance < 6) {
          const canvasPoint = viewportToCanvasPoint(locationX, locationY, panRef.current, zoomRef.current);
          const point = coordinateToSnapWithStep(canvasPoint.x, canvasPoint.y, sizeRef.current);
          callbacksRef.current.onPlace(point.xSnap, point.ySnap);
          callbacksRef.current.onGuidePlace?.();
        }

        setDragPreview(undefined);
        updateInteractionLock(false);
        pinchRef.current = undefined;
        dragRef.current = { startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false };
      },
      onPanResponderTerminate: () => {
        setDragPreview(undefined);
        updateInteractionLock(false);
        pinchRef.current = undefined;
        dragRef.current = { startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false };
      }
    })
  ).current;

  function beginPinchGesture(touches: readonly { locationX: number; locationY: number }[]) {
    const pinch = getPinchDetails(touches);
    if (!pinch) {
      return false;
    }

    pinchRef.current = {
      ...pinch,
      panX: panRef.current.x,
      panY: panRef.current.y,
      zoom: zoomRef.current
    };
    setDragPreview(undefined);
    callbacksRef.current.onSelect(undefined);
    updateInteractionLock(true);
    return true;
  }

  function updatePinchGesture(touches: readonly { locationX: number; locationY: number }[]) {
    const start = pinchRef.current;
    const current = getPinchDetails(touches);
    if (!start || !current) {
      return;
    }

    const nextZoom = clamp(start.zoom * (current.distance / start.distance), ZOOM_LEVELS[0], ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
    const startCanvasCenter = {
      x: (start.centerX + start.panX) / start.zoom,
      y: (start.centerY + start.panY) / start.zoom
    };
    const dimensions = dimensionsRef.current;
    const nextPan = clampPan(
      {
        x: startCanvasCenter.x * nextZoom - current.centerX,
        y: startCanvasCenter.y * nextZoom - current.centerY
      },
      dimensions.viewportWidth * nextZoom,
      dimensions.height * nextZoom,
      dimensions.viewportWidth,
      dimensions.height
    );

    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
    callbacksRef.current.onGuideZoomGesture?.();
  }

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
        <GuideTarget targetId="drill-zoom-buttons" style={styles.zoomControls}>
          <Pressable
            accessibilityLabel="縮小"
            disabled={zoom <= ZOOM_LEVELS[0]}
            style={[styles.zoomButton, zoom <= ZOOM_LEVELS[0] && styles.zoomButtonDisabled]}
            onPress={() => changeZoom(-1)}
          >
            <Minus size={16} color={zoom <= ZOOM_LEVELS[0] ? colors.textMuted : colors.text} />
          </Pressable>
          <Text style={styles.zoomValue}>{Math.round(zoom * 100)}%</Text>
          <Pressable
            accessibilityLabel="拡大"
            disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            style={[
              styles.zoomButton,
              zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1] && styles.zoomButtonDisabled
            ]}
            onPress={() => changeZoom(1)}
          >
            <Plus
              size={16}
              color={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ? colors.textMuted : colors.text}
            />
          </Pressable>
        </GuideTarget>
      </View>
      <View
        {...responder.panHandlers}
        onLayout={(event) => {
          const nextWidth = Math.max(280, event.nativeEvent.layout.width);
          setViewportWidth(nextWidth);
        }}
        style={[styles.canvas, { height }]}
      >
        <View
          style={[
            styles.canvasPlane,
            {
              height: displayHeight,
              transform: [{ translateX: -pan.x }, { translateY: -pan.y }],
              width: displayWidth
            }
          ]}
        >
          <Svg
            width={displayWidth}
            height={displayHeight}
            viewBox={`0 0 ${viewportWidth} ${height}`}
          >
            <Rect x={0} y={0} width={viewportWidth} height={height} fill="#ffffff" />
            {buildGrid(viewportWidth, height)}
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
                  <G transform={`translate(${x} ${y})`}>
                    {selected ? (
                      <Circle
                        cx={0}
                        cy={0}
                        r={markerRadius + 1}
                        fill="none"
                        stroke={colors.text}
                        strokeWidth={0.7}
                      />
                    ) : null}
                    <Circle cx={0} cy={0} r={markerRadius} fill={role.color} />
                  </G>
                  {labelLines.map((line, index) => {
                    const { fontSize, yOffset } = getMarkerTextMetrics(labelLines, index, markerRadius);
                    return (
                      <SvgText
                        key={`${marker.id}-${line}-${index}`}
                        x={x}
                        y={y + yOffset}
                        pointerEvents="none"
                        textAnchor="middle"
                        fontSize={fontSize}
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
        </View>
        {dragPreview && dragPreviewRole && dragPreviewParticipant ? (
          <View
            pointerEvents="none"
            style={[
              styles.dragPreview,
              {
                left: clampPreviewLeft(dragPreview.x + 14, viewportWidth),
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

function getMarkerRadius(width: number): number {
  if (width <= 430) {
    return clamp(width / 150, 2.4, 2.9);
  }

  return clamp(width / 125, 3.6, 4.9);
}

function getHitRadius(markerRadius: number): number {
  return Math.max(HIT_RADIUS * 0.72, markerRadius * 3.4);
}

function getPinchDetails(touches: readonly { locationX: number; locationY: number }[]) {
  if (touches.length < 2) {
    return undefined;
  }

  const first = touches[0];
  const second = touches[1];
  const dx = second.locationX - first.locationX;
  const dy = second.locationY - first.locationY;
  const distance = Math.max(1, Math.hypot(dx, dy));

  return {
    centerX: (first.locationX + second.locationX) / 2,
    centerY: (first.locationY + second.locationY) / 2,
    distance
  };
}

function viewportToCanvasPoint(
  x: number,
  y: number,
  pan: { x: number; y: number },
  zoom: number
) {
  return {
    x: (x + pan.x) / zoom,
    y: (y + pan.y) / zoom
  };
}

function coordinateToSnapWithStep(x: number, y: number, size: { width: number; height: number }) {
  const point = coordinateToSnap(x, y, size);
  const snapStep = size.width <= 430 ? SNAP.fineStep : 1;

  return {
    xSnap: clamp(Math.round(point.xSnap / snapStep) * snapStep, 0, SNAP.xMax),
    ySnap: clamp(Math.round(point.ySnap / snapStep) * snapStep, 0, SNAP.yMax)
  };
}

function clampPan(
  pan: { x: number; y: number },
  displayWidth: number,
  displayHeight: number,
  viewportWidth: number,
  viewportHeight: number
) {
  const maxX = Math.max(0, displayWidth - viewportWidth);
  const maxY = Math.max(0, displayHeight - viewportHeight);

  return {
    x: Math.min(Math.max(pan.x, 0), maxX),
    y: Math.min(Math.max(pan.y, 0), maxY)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getMarkerTextMetrics(labelLines: string[], index: number, markerRadius: number) {
  const maxLength = Math.max(...labelLines.map((line) => Array.from(line).length), 1);
  const scale = markerRadius / 6;

  if (labelLines.length === 1) {
    if (maxLength >= 3) {
      return { fontSize: 3.55 * scale, yOffset: 1.25 * scale };
    }

    if (maxLength === 2) {
      return { fontSize: 4.6 * scale, yOffset: 1.65 * scale };
    }

    return { fontSize: 5.5 * scale, yOffset: 2 * scale };
  }

  return {
    fontSize: 4.05 * scale,
    yOffset: (index === 0 ? -1.45 : 3.35) * scale
  };
}

function findNearestMarker(
  x: number,
  y: number,
  markers: MarkerView[],
  hitRadius: number
): MarkerView | undefined {
  let nearest: MarkerView | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const markerView of markers) {
    const distance = Math.hypot(markerView.x - x, markerView.y - y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = markerView;
    }
  }

  return nearestDistance <= hitRadius ? nearest : undefined;
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
  zoomControls: {
    position: "absolute",
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  zoomButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  zoomButtonDisabled: {
    opacity: 0.42
  },
  zoomValue: {
    minWidth: 42,
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  canvas: {
    width: "100%",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface
  },
  canvasPlane: {
    position: "absolute",
    left: 0,
    top: 0
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
    borderWidth: 0
  },
  dragPreviewText: {
    fontSize: 13,
    lineHeight: 14,
    fontWeight: "900"
  }
});
