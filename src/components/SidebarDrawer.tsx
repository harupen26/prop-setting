import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  Plus,
  SwatchBook,
  X
} from "lucide-react-native";
import Svg, { Rect } from "react-native-svg";

import type { AppAction } from "../state/appReducer";
import type { AppState, ApparatusRole } from "../types";
import { colors, radius, shadow } from "../theme";
import { getSelectedRole } from "../selectors";
import { GuideTarget } from "../guide/GuideOverlay";
import type { GuideTargetId } from "../guide/guideContent";

type Props = {
  visible: boolean;
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onClose: () => void;
  onGuideTargetPress?: (targetId: "sidebar-role-list") => void;
  guideOverlay?: ReactNode;
  guideTargetId?: GuideTargetId;
};

const palette = [
  "#4c1d95",
  "#2563eb",
  "#06b6d4",
  "#14b8a6",
  "#22c55e",
  "#d9f99d",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#a855f7",
  "#a3a3a3",
  "#111827"
];

const COLOR_WHEEL_SIZE = 168;
const COLOR_WHEEL_STEPS = 34;
const VALUE_SLIDER_WIDTH = 30;
const VALUE_SLIDER_STEPS = 28;

type HsvColor = {
  hue: number;
  saturation: number;
  value: number;
};

export function SidebarDrawer({
  visible,
  state,
  dispatch,
  onClose,
  onGuideTargetPress,
  guideOverlay,
  guideTargetId
}: Props) {
  const scrollRef = useRef<ScrollView | null>(null);
  const selectedRole = getSelectedRole(state);
  const [newFolderName, setNewFolderName] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState(palette[0]);
  const [newRoleHsv, setNewRoleHsv] = useState<HsvColor>(hexToHsv(palette[0]));
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState(state.folders[0]?.id ?? "");

  const rolesByFolder = useMemo(() => {
    const grouped = new Map<string, ApparatusRole[]>();
    for (const role of state.roles) {
      const list = grouped.get(role.folderId) ?? [];
      list.push(role);
      grouped.set(role.folderId, list);
    }

    grouped.forEach((list) => list.sort((a, b) => a.order - b.order));
    return grouped;
  }, [state.roles]);

  useEffect(() => {
    if (!visible || !guideTargetId) {
      return undefined;
    }

    const timer = setTimeout(() => {
      if (guideTargetId === "sidebar-add-role") {
        scrollRef.current?.scrollToEnd({ animated: true });
        return;
      }

      if (guideTargetId === "sidebar-role-list") {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    }, 260);

    return () => {
      clearTimeout(timer);
    };
  }, [guideTargetId, visible]);

  function addFolder() {
    const name = newFolderName.trim();
    if (!name) {
      return;
    }

    const folder = {
      id: `folder-${Date.now()}`,
      name,
      order: state.folders.length + 1,
      visible: true,
      collapsed: false
    };

    dispatch({ type: "addFolder", folder });
    setTargetFolderId(folder.id);
    setNewFolderName("");
  }

  function addRole() {
    const name = newRoleName.trim();
    if (!name || !targetFolderId) {
      return;
    }

    dispatch({
      type: "addRole",
      role: {
        id: `role-${Date.now()}`,
        folderId: targetFolderId,
        name,
        color: newRoleColor,
        order: state.roles.length + 1,
        visible: true
      }
    });
    setNewRoleName("");
  }

  function selectColor(color: string) {
    setNewRoleColor(color);
    setNewRoleHsv(hexToHsv(color));
  }

  function selectHsvColor(color: HsvColor) {
    setNewRoleHsv(color);
    setNewRoleColor(hsvToHex(color));
  }

  function selectRole(roleId: string) {
    dispatch({ type: "setSelectedRole", roleId });
    onGuideTargetPress?.("sidebar-role-list");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>手具</Text>
              <Text style={styles.subtitle}>選択中: {selectedRole?.name}</Text>
            </View>
            <Pressable accessibilityLabel="閉じる" style={styles.iconButton} onPress={onClose}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
            <GuideTarget targetId="sidebar-role-list" style={styles.roleListGuideTarget}>
              {state.folders
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((folderItem) => {
                  const folderRoles = rolesByFolder.get(folderItem.id) ?? [];
                  return (
                    <View key={folderItem.id} style={styles.folderBlock}>
                      <View style={styles.folderHeader}>
                        <Pressable
                          accessibilityLabel={`${folderItem.name}を開閉`}
                          style={styles.folderTitle}
                          onPress={() =>
                            dispatch({ type: "toggleFolderCollapsed", folderId: folderItem.id })
                          }
                        >
                          {folderItem.collapsed ? (
                            <ChevronRight size={18} color={colors.text} />
                          ) : (
                            <ChevronDown size={18} color={colors.text} />
                          )}
                          <Folder size={17} color={colors.textMuted} />
                          <Text style={styles.folderText}>{folderItem.name}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={folderItem.visible ? "非表示にする" : "表示する"}
                          style={styles.eyeButton}
                          onPress={() =>
                            dispatch({ type: "toggleFolderVisible", folderId: folderItem.id })
                          }
                        >
                          {folderItem.visible ? (
                            <Eye size={18} color={colors.text} />
                          ) : (
                            <EyeOff size={18} color={colors.textMuted} />
                          )}
                        </Pressable>
                      </View>

                      {!folderItem.collapsed &&
                        folderRoles.map((role) => {
                          const selected = role.id === state.selectedRoleId;
                          return (
                            <View key={role.id} style={[styles.roleRow, selected && styles.roleRowActive]}>
                              <Pressable
                                style={styles.roleMain}
                                onPress={() => selectRole(role.id)}
                              >
                                <View style={[styles.swatch, { backgroundColor: role.color }]} />
                                <Text style={styles.roleText} numberOfLines={2}>
                                  {role.name}
                                </Text>
                              </Pressable>
                              <Pressable
                                accessibilityLabel={role.visible ? "非表示にする" : "表示する"}
                                style={styles.eyeButton}
                                onPress={() => dispatch({ type: "toggleRoleVisible", roleId: role.id })}
                              >
                                {role.visible ? (
                                  <Eye size={18} color={colors.text} />
                                ) : (
                                  <EyeOff size={18} color={colors.textMuted} />
                                )}
                              </Pressable>
                            </View>
                          );
                        })}
                    </View>
                  );
                })}
            </GuideTarget>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>フォルダー追加</Text>
              <View style={styles.inlineForm}>
                <TextInput
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  placeholder="例: M4"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
                <Pressable accessibilityLabel="フォルダー追加" style={styles.addIconButton} onPress={addFolder}>
                  <Plus size={18} color="#ffffff" />
                </Pressable>
              </View>
            </View>

            <GuideTarget targetId="sidebar-add-role" style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <SwatchBook size={17} color={colors.text} />
                <Text style={styles.sectionTitle}>手具追加</Text>
              </View>
              <TextInput
                value={newRoleName}
                onChangeText={setNewRoleName}
                placeholder="手具名"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.palette}>
                {palette.map((item) => (
                  <Pressable
                    key={item}
                    accessibilityLabel={`${item}を選択`}
                    onPress={() => selectColor(item)}
                    style={[
                      styles.paletteSwatch,
                      { backgroundColor: item },
                      item === newRoleColor && styles.paletteSwatchActive
                    ]}
                  />
                ))}
                <Pressable
                  accessibilityLabel="自由色を選択"
                  onPress={() => {
                    setCustomColorOpen((value) => !value);
                  }}
                  style={[
                    styles.paletteSwatch,
                    styles.paletteAddButton,
                    !palette.includes(newRoleColor) && styles.paletteSwatchActive
                  ]}
                >
                  <Plus size={18} color={colors.text} />
                </Pressable>
              </ScrollView>
              {customColorOpen ? (
                <ColorWheelPicker
                  hsv={newRoleHsv}
                  selectedColor={newRoleColor}
                  onChange={selectHsvColor}
                />
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderChips}>
                {state.folders.map((folderItem) => (
                  <Pressable
                    key={folderItem.id}
                    onPress={() => setTargetFolderId(folderItem.id)}
                    style={[
                      styles.folderChip,
                      targetFolderId === folderItem.id && styles.folderChipActive
                    ]}
                  >
                    <Text
                      style={[
                        styles.folderChipText,
                        targetFolderId === folderItem.id && styles.folderChipTextActive
                      ]}
                    >
                      {folderItem.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.primaryButton} onPress={addRole}>
                <Text style={styles.primaryButtonText}>手具を追加</Text>
              </Pressable>
            </GuideTarget>
          </ScrollView>
        </View>
        {guideOverlay}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    position: "relative",
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.18)"
  },
  backdrop: {
    flex: 1
  },
  panel: {
    width: "88%",
    maxWidth: 420,
    height: "100%",
    backgroundColor: colors.surface,
    paddingTop: 18,
    ...shadow
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  subtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40
  },
  roleListGuideTarget: {
    gap: 16
  },
  folderBlock: {
    gap: 6
  },
  folderHeader: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  folderTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  folderText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  eyeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  roleRow: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    backgroundColor: colors.surface
  },
  roleRowActive: {
    borderColor: colors.text,
    backgroundColor: colors.primarySoft
  },
  roleMain: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(17, 24, 39, 0.18)"
  },
  roleText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700"
  },
  section: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  inlineForm: {
    flexDirection: "row",
    gap: 8
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.surface
  },
  addIconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  palette: {
    gap: 8,
    paddingVertical: 2
  },
  paletteSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(17, 24, 39, 0.14)"
  },
  paletteSwatchActive: {
    borderWidth: 3,
    borderColor: colors.text
  },
  paletteAddButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderStyle: "dashed"
  },
  colorPickerPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    backgroundColor: colors.surfaceSoft,
    gap: 10
  },
  colorPickerRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  colorWheel: {
    width: COLOR_WHEEL_SIZE,
    height: COLOR_WHEEL_SIZE,
    borderRadius: COLOR_WHEEL_SIZE / 2,
    overflow: "hidden",
    backgroundColor: colors.surface
  },
  colorWheelCursor: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ffffff",
    shadowColor: "#111827",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2
  },
  valueSlider: {
    width: VALUE_SLIDER_WIDTH,
    height: COLOR_WHEEL_SIZE,
    borderRadius: 15,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(17, 24, 39, 0.14)"
  },
  valueSliderCursor: {
    position: "absolute",
    left: -4,
    width: VALUE_SLIDER_WIDTH + 8,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(17, 24, 39, 0.12)"
  },
  selectedColorLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  selectedColorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(17, 24, 39, 0.14)"
  },
  selectedColorText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  folderChips: {
    gap: 8
  },
  folderChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  folderChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  folderChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700"
  },
  folderChipTextActive: {
    color: "#ffffff"
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  }
});

function ColorWheelPicker({
  hsv,
  selectedColor,
  onChange
}: {
  hsv: HsvColor;
  selectedColor: string;
  onChange: (color: HsvColor) => void;
}) {
  const wheelCells = useMemo(() => buildColorWheelCells(hsv.value), [hsv.value]);
  const sliderCells = useMemo(() => buildValueSliderCells(hsv), [hsv]);
  const center = COLOR_WHEEL_SIZE / 2;
  const wheelRadius = COLOR_WHEEL_SIZE / 2;
  const cursorRadius = hsv.saturation * wheelRadius;
  const cursorX = center + Math.cos((hsv.hue * Math.PI) / 180) * cursorRadius;
  const cursorY = center + Math.sin((hsv.hue * Math.PI) / 180) * cursorRadius;
  const sliderY = (1 - hsv.value) * COLOR_WHEEL_SIZE;

  const wheelResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          onChange(pointToHsv(locationX, locationY, hsv.value));
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          onChange(pointToHsv(locationX, locationY, hsv.value));
        }
      }),
    [hsv.value, onChange]
  ).panHandlers;

  const sliderResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          onChange({ ...hsv, value: sliderPointToValue(event.nativeEvent.locationY) });
        },
        onPanResponderMove: (event) => {
          onChange({ ...hsv, value: sliderPointToValue(event.nativeEvent.locationY) });
        }
      }),
    [hsv, onChange]
  ).panHandlers;

  return (
    <View style={styles.colorPickerPanel}>
      <View style={styles.colorPickerRow}>
        <View {...wheelResponder} style={styles.colorWheel}>
          <Svg width={COLOR_WHEEL_SIZE} height={COLOR_WHEEL_SIZE}>
            {wheelCells}
          </Svg>
          <View
            pointerEvents="none"
            style={[
              styles.colorWheelCursor,
              {
                backgroundColor: selectedColor,
                left: cursorX - 8,
                top: cursorY - 8
              }
            ]}
          />
        </View>
        <View {...sliderResponder} style={styles.valueSlider}>
          <Svg width={VALUE_SLIDER_WIDTH} height={COLOR_WHEEL_SIZE}>
            {sliderCells}
          </Svg>
          <View pointerEvents="none" style={[styles.valueSliderCursor, { top: sliderY - 5 }]} />
        </View>
      </View>
      <View style={styles.selectedColorLine}>
        <View style={[styles.selectedColorPreview, { backgroundColor: selectedColor }]} />
        <Text style={styles.selectedColorText}>選択中の色</Text>
      </View>
    </View>
  );
}

function buildColorWheelCells(value: number) {
  const cells = [];
  const cell = COLOR_WHEEL_SIZE / COLOR_WHEEL_STEPS;
  const center = COLOR_WHEEL_SIZE / 2;
  const radius = COLOR_WHEEL_SIZE / 2;

  for (let row = 0; row < COLOR_WHEEL_STEPS; row += 1) {
    for (let col = 0; col < COLOR_WHEEL_STEPS; col += 1) {
      const x = col * cell;
      const y = row * cell;
      const dx = x + cell / 2 - center;
      const dy = y + cell / 2 - center;
      const distance = Math.hypot(dx, dy);

      if (distance > radius) {
        continue;
      }

      const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const saturation = Math.min(1, distance / radius);
      cells.push(
        <Rect
          key={`${row}-${col}`}
          x={x}
          y={y}
          width={cell + 0.5}
          height={cell + 0.5}
          fill={hsvToHex({ hue, saturation, value })}
        />
      );
    }
  }

  return cells;
}

function buildValueSliderCells(hsv: HsvColor) {
  const cells = [];
  const cellHeight = COLOR_WHEEL_SIZE / VALUE_SLIDER_STEPS;

  for (let index = 0; index < VALUE_SLIDER_STEPS; index += 1) {
    const value = 1 - index / (VALUE_SLIDER_STEPS - 1);
    cells.push(
      <Rect
        key={index}
        x={0}
        y={index * cellHeight}
        width={VALUE_SLIDER_WIDTH}
        height={cellHeight + 0.5}
        fill={hsvToHex({ ...hsv, value })}
      />
    );
  }

  return cells;
}

function pointToHsv(x: number, y: number, value: number): HsvColor {
  const center = COLOR_WHEEL_SIZE / 2;
  const radius = COLOR_WHEEL_SIZE / 2;
  const dx = x - center;
  const dy = y - center;
  const distance = Math.min(radius, Math.hypot(dx, dy));

  return {
    hue: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360,
    saturation: distance / radius,
    value
  };
}

function sliderPointToValue(y: number): number {
  return 1 - clamp(y / COLOR_WHEEL_SIZE, 0, 1);
}

function hsvToHex({ hue, saturation, value }: HsvColor): string {
  const chroma = value * saturation;
  const huePrime = hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = x;
  } else if (huePrime >= 1 && huePrime < 2) {
    red = x;
    green = chroma;
  } else if (huePrime >= 2 && huePrime < 3) {
    green = chroma;
    blue = x;
  } else if (huePrime >= 3 && huePrime < 4) {
    green = x;
    blue = chroma;
  } else if (huePrime >= 4 && huePrime < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return `#${toHexByte((red + match) * 255)}${toHexByte((green + match) * 255)}${toHexByte(
    (blue + match) * 255
  )}`;
}

function hexToHsv(hex: string): HsvColor {
  const clean = hex.replace("#", "");
  const red = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const green = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    hue: (hue + 360) % 360,
    saturation: max === 0 ? 0 : delta / max,
    value: max
  };
}

function toHexByte(value: number): string {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
