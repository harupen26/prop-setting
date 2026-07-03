import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { colors, radius } from "../theme";
import type { GuideStep, GuideTargetId } from "./guideContent";

type TargetLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GuideRegistry = {
  registerTarget: (targetId: GuideTargetId, ref: RefObject<View | null>) => () => void;
  measureTarget: (targetId: GuideTargetId) => Promise<TargetLayout | undefined>;
  revision: number;
};

const GuideContext = createContext<GuideRegistry | undefined>(undefined);

const OVERLAY_COLOR = "rgba(15, 23, 42, 0.62)";
const ACTION_OVERLAY_COLOR = "rgba(15, 23, 42, 0.12)";
const TARGET_PADDING = 7;
const BUBBLE_MARGIN = 10;
const BUBBLE_GAP = 10;
const BUBBLE_WIDTH = 304;
const ESTIMATED_BUBBLE_HEIGHT = 178;
const ACTION_FALLBACK_DELAY_MS = 4200;
const FADE_IN_DELAY_MS = 90;
const FADE_IN_DURATION_MS = 240;

export function GuideProvider({ children }: { children: ReactNode }) {
  const targetsRef = useRef(new Map<GuideTargetId, RefObject<View | null>>());
  const [revision, setRevision] = useState(0);

  const registerTarget = useCallback((targetId: GuideTargetId, ref: RefObject<View | null>) => {
    targetsRef.current.set(targetId, ref);
    setRevision((value) => value + 1);

    return () => {
      if (targetsRef.current.get(targetId) === ref) {
        targetsRef.current.delete(targetId);
        setRevision((value) => value + 1);
      }
    };
  }, []);

  const measureTarget = useCallback(async (targetId: GuideTargetId) => {
    const ref = targetsRef.current.get(targetId);
    if (!ref?.current) {
      return undefined;
    }

    return new Promise<TargetLayout | undefined>((resolve) => {
      const node = ref.current as View & {
        measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
      };

      if (!node.measureInWindow) {
        resolve(undefined);
        return;
      }

      node.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) {
          resolve(undefined);
          return;
        }

        resolve({ x, y, width, height });
      });
    });
  }, []);

  const value = useMemo(
    () => ({ registerTarget, measureTarget, revision }),
    [measureTarget, registerTarget, revision]
  );

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function GuideTarget({
  targetId,
  children,
  style
}: {
  targetId: GuideTargetId;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const registry = useContext(GuideContext);
  const registerTarget = registry?.registerTarget;
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!registerTarget) {
      return undefined;
    }

    return registerTarget(targetId, ref);
  }, [registerTarget, targetId]);

  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

export function GuideOverlay({
  visible,
  step,
  stepIndex,
  stepCount,
  onNext,
  onBack,
  onSkip,
  embedded = false,
  practiceMode = false
}: {
  visible: boolean;
  step: GuideStep | undefined;
  stepIndex: number;
  stepCount: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  embedded?: boolean;
  practiceMode?: boolean;
}) {
  const registry = useContext(GuideContext);
  const measureTarget = registry?.measureTarget;
  const registryRevision = registry?.revision;
  const dimensions = useWindowDimensions();
  const [targetLayout, setTargetLayout] = useState<TargetLayout | undefined>();
  const [bubbleHeight, setBubbleHeight] = useState(ESTIMATED_BUBBLE_HEIGHT);
  const [actionFallbackVisible, setActionFallbackVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const stepId = step?.id;
  const waitsForTargetAction = !!step?.advanceOnTargetPress && !!step.targetId;
  const actionPassThrough = waitsForTargetAction && !actionFallbackVisible;

  useEffect(() => {
    let cancelled = false;

    async function measure() {
      if (!visible || !step?.targetId || !measureTarget) {
        setTargetLayout(undefined);
        return;
      }

      const layout = await measureTarget(step.targetId);
      if (!cancelled) {
        setTargetLayout(layout);
      }
    }

    const first = setTimeout(measure, 80);
    const second = setTimeout(measure, 340);
    const third = setTimeout(measure, 760);
    const fourth = setTimeout(measure, 1120);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearTimeout(second);
      clearTimeout(third);
      clearTimeout(fourth);
    };
  }, [measureTarget, registryRevision, step?.targetId, visible]);

  useEffect(() => {
    setBubbleHeight(ESTIMATED_BUBBLE_HEIGHT);
    setActionFallbackVisible(false);
    fadeAnim.setValue(0);

    if (!visible) {
      return undefined;
    }

    const fadeTimer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: FADE_IN_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false
      }).start();
    }, FADE_IN_DELAY_MS);

    const fallbackTimer = waitsForTargetAction
      ? setTimeout(() => {
          setActionFallbackVisible(true);
        }, ACTION_FALLBACK_DELAY_MS)
      : undefined;

    return () => {
      clearTimeout(fadeTimer);
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
    };
  }, [fadeAnim, stepId, visible, waitsForTargetAction]);

  if (!visible || !step) {
    return null;
  }

  const bubbleStyle = getBubbleStyle(targetLayout, dimensions.width, dimensions.height, step.placement, bubbleHeight);
  const finalStep = stepIndex >= stepCount - 1;
  const showPrimaryButton = !waitsForTargetAction || actionFallbackVisible;
  const primaryButtonLabel = waitsForTargetAction ? "できない時は次へ" : finalStep ? "完了" : "次へ";
  const useFloatingOverlay = waitsForTargetAction || embedded;
  const showPracticeNote = practiceMode && stepIndex === 0;
  const handleBubbleLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (Math.abs(nextHeight - bubbleHeight) > 2) {
      setBubbleHeight(nextHeight);
    }
  };
  const content = (
    <Animated.View
      style={[
        useFloatingOverlay ? styles.floatingOverlay : styles.overlay,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [6, 0]
              })
            }
          ]
        }
      ]}
      pointerEvents={actionPassThrough ? "none" : waitsForTargetAction ? "box-none" : "auto"}
    >
      <OverlayScrim
        layout={targetLayout}
        width={dimensions.width}
        height={dimensions.height}
        allowTargetPress={waitsForTargetAction}
        soft={waitsForTargetAction}
      />
      {targetLayout ? <View pointerEvents="none" style={getHighlightStyle(targetLayout)} /> : null}
      <View
        pointerEvents={actionPassThrough ? "none" : waitsForTargetAction ? "box-none" : "auto"}
        style={[styles.bubble, bubbleStyle]}
        onLayout={handleBubbleLayout}
      >
        <View style={styles.bubbleTop}>
          <Text style={styles.progress}>
            {stepIndex + 1} / {stepCount}
          </Text>
          <Pressable style={styles.closeTextButton} onPress={onSkip}>
            <Text style={styles.closeText}>閉じる</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>
        {showPracticeNote ? (
          <Text style={styles.practiceText}>練習中: チュートリアル終了時に操作内容は元に戻ります。</Text>
        ) : null}
        {waitsForTargetAction ? (
          <Text style={styles.actionHint}>{step.targetActionLabel ?? "ハイライトされた場所を押してください"}</Text>
        ) : null}
        {!targetLayout && step.targetId ? (
          <Text style={styles.fallbackText}>対象のボタンが見つからないため、説明カードで表示しています。</Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable style={styles.ghostButton} onPress={onSkip}>
            <Text style={styles.ghostButtonText}>スキップ</Text>
          </Pressable>
          <View style={styles.actionRight}>
            {stepIndex > 0 ? (
              <Pressable style={styles.secondaryButton} onPress={onBack}>
                <Text style={styles.secondaryButtonText}>戻る</Text>
              </Pressable>
            ) : null}
            {showPrimaryButton ? (
              <Pressable style={[styles.primaryButton, waitsForTargetAction ? styles.fallbackNextButton : null]} onPress={onNext}>
                <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  );

  if (waitsForTargetAction || embedded) {
    return content;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      {content}
    </Modal>
  );
}

function OverlayScrim({
  layout,
  width,
  height,
  allowTargetPress = false,
  soft = false
}: {
  layout: TargetLayout | undefined;
  width: number;
  height: number;
  allowTargetPress?: boolean;
  soft?: boolean;
}) {
  const scrimStyle = [styles.scrimPiece, { backgroundColor: soft ? ACTION_OVERLAY_COLOR : OVERLAY_COLOR }];

  if (!layout) {
    return (
      <View
        pointerEvents={allowTargetPress ? "none" : "auto"}
        style={[styles.fullScrim, { backgroundColor: soft ? ACTION_OVERLAY_COLOR : OVERLAY_COLOR }]}
      />
    );
  }

  const piecePointerEvents = allowTargetPress ? "none" : "auto";
  const highlight = expandLayout(layout);
  const topHeight = Math.max(0, highlight.y);
  const bottomTop = Math.min(height, highlight.y + highlight.height);
  const sideTop = topHeight;
  const sideHeight = Math.max(0, highlight.height);

  return (
    <>
      <View pointerEvents={piecePointerEvents} style={[scrimStyle, { left: 0, right: 0, top: 0, height: topHeight }]} />
      <View pointerEvents={piecePointerEvents} style={[scrimStyle, { left: 0, right: 0, top: bottomTop, bottom: 0 }]} />
      <View
        pointerEvents={piecePointerEvents}
        style={[scrimStyle, { left: 0, top: sideTop, width: Math.max(0, highlight.x), height: sideHeight }]}
      />
      <View
        pointerEvents={piecePointerEvents}
        style={[
          scrimStyle,
          {
            left: Math.min(width, highlight.x + highlight.width),
            right: 0,
            top: sideTop,
            height: sideHeight
          }
        ]}
      />
    </>
  );
}

function expandLayout(layout: TargetLayout): TargetLayout {
  return {
    x: Math.max(0, layout.x - TARGET_PADDING),
    y: Math.max(0, layout.y - TARGET_PADDING),
    width: layout.width + TARGET_PADDING * 2,
    height: layout.height + TARGET_PADDING * 2
  };
}

function getHighlightStyle(layout: TargetLayout): ViewStyle {
  const expanded = expandLayout(layout);
  return {
    position: "absolute",
    left: expanded.x,
    top: expanded.y,
    width: expanded.width,
    height: expanded.height,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  };
}

function getBubbleStyle(
  layout: TargetLayout | undefined,
  screenWidth: number,
  screenHeight: number,
  placement: GuideStep["placement"],
  measuredBubbleHeight: number
): ViewStyle {
  const width = Math.min(BUBBLE_WIDTH, screenWidth - BUBBLE_MARGIN * 2);
  const bubbleHeight = Math.max(120, measuredBubbleHeight || ESTIMATED_BUBBLE_HEIGHT);
  const maxTop = Math.max(BUBBLE_MARGIN, screenHeight - bubbleHeight - BUBBLE_MARGIN);
  const maxHeight = Math.max(140, screenHeight - BUBBLE_MARGIN * 2);

  if (!layout || placement === "center" || placement === "screen-top" || placement === "screen-bottom") {
    return {
      left: (screenWidth - width) / 2,
      top:
        placement === "screen-top"
          ? BUBBLE_MARGIN
          : placement === "screen-bottom"
            ? maxTop
            : clamp((screenHeight - bubbleHeight) / 2, BUBBLE_MARGIN, maxTop),
      width,
      maxHeight
    };
  }

  const target = expandLayout(layout);
  const aboveTop = target.y - bubbleHeight - BUBBLE_GAP;
  const belowTop = target.y + target.height + BUBBLE_GAP;
  const topSpace = target.y - BUBBLE_MARGIN - BUBBLE_GAP;
  const bottomSpace = screenHeight - (target.y + target.height) - BUBBLE_MARGIN - BUBBLE_GAP;
  const canFitAbove = topSpace >= bubbleHeight;
  const canFitBelow = bottomSpace >= bubbleHeight;
  const preferTop = placement === "top";
  const preferBottom = placement === "bottom" || !placement;
  const rawTop =
    preferTop && canFitAbove
      ? aboveTop
      : preferBottom && canFitBelow
        ? belowTop
        : canFitAbove
          ? aboveTop
          : canFitBelow
            ? belowTop
            : bottomSpace >= topSpace
              ? clamp(belowTop, BUBBLE_MARGIN, maxTop)
              : clamp(aboveTop, BUBBLE_MARGIN, maxTop);
  const top = clamp(rawTop, BUBBLE_MARGIN, maxTop);

  return {
    left: clamp(target.x + target.width / 2 - width / 2, BUBBLE_MARGIN, screenWidth - width - BUBBLE_MARGIN),
    top,
    width,
    maxHeight
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1
  },
  floatingOverlay: {
    ...StyleSheet.absoluteFill,
    elevation: 1000,
    zIndex: 1000
  },
  fullScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: OVERLAY_COLOR
  },
  scrimPiece: {
    position: "absolute",
    backgroundColor: OVERLAY_COLOR
  },
  bubble: {
    position: "absolute",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    padding: 14,
    gap: 7,
    backgroundColor: colors.surface
  },
  bubbleTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  progress: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900"
  },
  closeTextButton: {
    minHeight: 28,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  closeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  body: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  fallbackText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  practiceText: {
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    backgroundColor: colors.surfaceSoft
  },
  actionHint: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900"
  },
  actions: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  actionRight: {
    flexDirection: "row",
    gap: 8
  },
  ghostButton: {
    minHeight: 38,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  ghostButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800"
  },
  secondaryButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  primaryButton: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  fallbackNextButton: {
    paddingHorizontal: 12,
    backgroundColor: colors.text
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  }
});
