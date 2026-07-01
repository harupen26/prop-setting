import { useMemo, useState } from "react";
import {
  Modal,
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

import type { AppAction } from "../state/appReducer";
import type { AppState, ApparatusRole } from "../types";
import { colors, radius, shadow } from "../theme";
import { getSelectedRole } from "../selectors";

type Props = {
  visible: boolean;
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onClose: () => void;
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

export function SidebarDrawer({ visible, state, dispatch, onClose }: Props) {
  const selectedRole = getSelectedRole(state);
  const [newFolderName, setNewFolderName] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState(palette[0]);
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

  function selectRole(roleId: string) {
    dispatch({ type: "setSelectedRole", roleId });
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

          <ScrollView contentContainerStyle={styles.content}>
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

            <View style={styles.section}>
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
                    onPress={() => setNewRoleColor(item)}
                    style={[
                      styles.paletteSwatch,
                      { backgroundColor: item },
                      item === newRoleColor && styles.paletteSwatchActive
                    ]}
                  />
                ))}
              </ScrollView>
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
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
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
