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
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
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
const TARGET_PADDING = 7;
const BUBBLE_MARGIN = 14;
const BUBBLE_WIDTH = 318;
const ESTIMATED_BUBBLE_HEIGHT = 210;

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
  onSkip
}: {
  visible: boolean;
  step: GuideStep | undefined;
  stepIndex: number;
  stepCount: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const registry = useContext(GuideContext);
  const measureTarget = registry?.measureTarget;
  const registryRevision = registry?.revision;
  const dimensions = useWindowDimensions();
  const [targetLayout, setTargetLayout] = useState<TargetLayout | undefined>();

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

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [measureTarget, registryRevision, step?.targetId, visible]);

  if (!step) {
    return null;
  }

  const bubbleStyle = getBubbleStyle(targetLayout, dimensions.width, dimensions.height, step.placement);
  const finalStep = stepIndex >= stepCount - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.overlay}>
        <OverlayScrim layout={targetLayout} width={dimensions.width} height={dimensions.height} />
        {targetLayout ? <View pointerEvents="none" style={getHighlightStyle(targetLayout)} /> : null}
        <View style={[styles.bubble, bubbleStyle]}>
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
              <Pressable style={styles.primaryButton} onPress={onNext}>
                <Text style={styles.primaryButtonText}>{finalStep ? "完了" : "次へ"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function OverlayScrim({
  layout,
  width,
  height
}: {
  layout: TargetLayout | undefined;
  width: number;
  height: number;
}) {
  if (!layout) {
    return <View style={styles.fullScrim} />;
  }

  const highlight = expandLayout(layout);
  const topHeight = Math.max(0, highlight.y);
  const bottomTop = Math.min(height, highlight.y + highlight.height);
  const sideTop = topHeight;
  const sideHeight = Math.max(0, highlight.height);

  return (
    <>
      <View style={[styles.scrimPiece, { left: 0, right: 0, top: 0, height: topHeight }]} />
      <View style={[styles.scrimPiece, { left: 0, right: 0, top: bottomTop, bottom: 0 }]} />
      <View style={[styles.scrimPiece, { left: 0, top: sideTop, width: Math.max(0, highlight.x), height: sideHeight }]} />
      <View
        style={[
          styles.scrimPiece,
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
  placement: GuideStep["placement"]
): ViewStyle {
  const width = Math.min(BUBBLE_WIDTH, screenWidth - BUBBLE_MARGIN * 2);

  if (!layout || placement === "center") {
    return {
      left: (screenWidth - width) / 2,
      top: Math.max(BUBBLE_MARGIN, (screenHeight - ESTIMATED_BUBBLE_HEIGHT) / 2),
      width
    };
  }

  const target = expandLayout(layout);
  const preferredTop = placement === "top" ? target.y - ESTIMATED_BUBBLE_HEIGHT - 12 : target.y + target.height + 12;
  const hasBottomSpace = target.y + target.height + ESTIMATED_BUBBLE_HEIGHT + 24 < screenHeight;
  const hasTopSpace = target.y - ESTIMATED_BUBBLE_HEIGHT - 12 > BUBBLE_MARGIN;
  const top =
    placement === "top" && hasTopSpace
      ? preferredTop
      : placement === "bottom" && hasBottomSpace
        ? preferredTop
        : hasBottomSpace
          ? target.y + target.height + 12
          : hasTopSpace
            ? target.y - ESTIMATED_BUBBLE_HEIGHT - 12
            : Math.max(BUBBLE_MARGIN, screenHeight - ESTIMATED_BUBBLE_HEIGHT - BUBBLE_MARGIN);

  return {
    left: clamp(target.x + target.width / 2 - width / 2, BUBBLE_MARGIN, screenWidth - width - BUBBLE_MARGIN),
    top,
    width
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1
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
    padding: 16,
    gap: 8,
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
    fontSize: 18,
    fontWeight: "900"
  },
  body: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  fallbackText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  actions: {
    marginTop: 8,
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
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  }
});
