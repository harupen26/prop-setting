import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Eye, Menu, Settings, Trash2, Users } from "lucide-react-native";

import { AdminPanel } from "./src/components/AdminPanel";
import { DrillCanvas } from "./src/components/DrillCanvas";
import { SegmentedControl } from "./src/components/SegmentedControl";
import { SidebarDrawer } from "./src/components/SidebarDrawer";
import { buildPdfHtml } from "./src/domain/pdf";
import { usePersistentState } from "./src/state/usePersistentState";
import { colors, radius } from "./src/theme";
import type { Phase, ViewMode } from "./src/types";
import {
  getActiveCompetition,
  getActiveParticipant,
  getSelectedRole,
  getVisibleMarkers,
  isRoleVisible
} from "./src/selectors";
import { isSupabaseConfigured } from "./src/lib/supabase";

export default function App() {
  const { state, dispatch, hydrated } = usePersistentState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | undefined>();
  const activeCompetition = getActiveCompetition(state);
  const activeParticipant = getActiveParticipant(state);
  const selectedRole = getSelectedRole(state);
  const visibleMarkers = getVisibleMarkers(state);
  const visibleRoleCount = useMemo(
    () => state.roles.filter((role) => isRoleVisible(state, role.id)).length,
    [state]
  );

  function placeMarker(xSnap: number, ySnap: number) {
    if (!selectedRole) {
      return;
    }

    dispatch({
      type: "placeMarker",
      marker: {
        id: `marker-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        competitionId: state.activeCompetitionId,
        participantId: state.activeParticipantId,
        roleId: selectedRole.id,
        phase: state.activePhase,
        xSnap,
        ySnap,
        updatedAt: new Date().toISOString()
      }
    });
  }

  async function exportPdf() {
    try {
      const html = buildPdfHtml(state);
      if (Platform.OS === "web") {
        await Print.printAsync({ html });
        return;
      }

      const file = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/pdf",
          dialogTitle: "手具セットPDF"
        });
      } else {
        Alert.alert("PDFを作成しました", file.uri);
      }
    } catch (error) {
      Alert.alert("PDF出力に失敗しました", error instanceof Error ? error.message : "もう一度お試しください。");
    }
  }

  const selectedMarker = state.markers.find((marker) => marker.id === selectedMarkerId);

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.text} />
        <Text style={styles.loadingText}>読み込み中</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.appName}>手具セット管理</Text>
          <Text style={styles.appMeta}>
            {activeCompetition?.name ?? "大会未設定"} / {activeParticipant.name}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="手具を開く"
            style={styles.iconButton}
            onPress={() => setDrawerOpen(true)}
          >
            <Menu size={21} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="管理を開く"
            style={[styles.iconButton, adminOpen && styles.iconButtonActive]}
            onPress={() => setAdminOpen((value) => !value)}
          >
            <Settings size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topControls}>
          <SegmentedControl<Phase>
            value={state.activePhase}
            options={[
              { value: "entry", label: "入場" },
              { value: "exit", label: "退場" }
            ]}
            onChange={(phase) => {
              setSelectedMarkerId(undefined);
              dispatch({ type: "setPhase", phase });
            }}
          />
          <SegmentedControl<ViewMode>
            value={state.viewMode}
            options={[
              { value: "participant", label: "編集中" },
              { value: "master", label: "統合表示" }
            ]}
            onChange={(viewMode) => {
              setSelectedMarkerId(undefined);
              dispatch({ type: "setViewMode", viewMode });
            }}
          />
        </View>

        <View style={styles.participantArea}>
          <View style={styles.sectionHead}>
            <Users size={17} color={colors.text} />
            <Text style={styles.sectionTitle}>参加者</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.participantList}>
            {state.participants.map((participant) => {
              const active = participant.id === state.activeParticipantId;
              return (
                <Pressable
                  key={participant.id}
                  onPress={() => {
                    setSelectedMarkerId(undefined);
                    dispatch({ type: "setActiveParticipant", participantId: participant.id });
                  }}
                  style={[styles.participantChip, active && styles.participantChipActive]}
                >
                  <Text
                    style={[styles.participantChipText, active && styles.participantChipTextActive]}
                    numberOfLines={1}
                  >
                    {participant.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.selectionBar}>
          <View style={styles.selectedRoleLine}>
            <View style={[styles.selectedSwatch, { backgroundColor: selectedRole?.color ?? colors.border }]} />
            <View style={styles.selectedRoleTextWrap}>
              <Text style={styles.selectedRoleLabel}>配置する手具</Text>
              <Text style={styles.selectedRoleName}>{selectedRole?.name ?? "未選択"}</Text>
            </View>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => setDrawerOpen(true)}>
            <Text style={styles.secondaryButtonText}>変更</Text>
          </Pressable>
        </View>

        <DrillCanvas
          phase={state.activePhase}
          markers={visibleMarkers}
          roles={state.roles}
          participants={state.participants}
          selectedMarkerId={selectedMarkerId}
          onPlace={placeMarker}
          onMove={(markerId, xSnap, ySnap) =>
            dispatch({ type: "moveMarker", markerId, xSnap, ySnap })
          }
          onSelect={setSelectedMarkerId}
        />

        <View style={styles.canvasHelp}>
          <Text style={styles.canvasHelpText}>
            タップで配置、丸をドラッグで移動。配置は格子点と中間に吸着します。
          </Text>
        </View>

        {selectedMarker ? (
          <View style={styles.markerInspector}>
            <View>
              <Text style={styles.markerInspectorTitle}>選択中の丸</Text>
              <Text style={styles.markerInspectorText}>
                横 {selectedMarker.xSnap} / 縦 {selectedMarker.ySnap}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="丸を削除"
              style={styles.deleteButton}
              onPress={() => {
                dispatch({ type: "deleteMarker", markerId: selectedMarker.id });
                setSelectedMarkerId(undefined);
              }}
            >
              <Trash2 size={17} color="#ffffff" />
              <Text style={styles.deleteButtonText}>削除</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.legendSummary}>
          <View style={styles.sectionHead}>
            <Eye size={17} color={colors.text} />
            <Text style={styles.sectionTitle}>表示中の手具</Text>
          </View>
          <Text style={styles.legendSummaryText}>
            {visibleRoleCount}種類を表示中 / Supabase接続: {isSupabaseConfigured ? "設定済み" : "未設定"}
          </Text>
        </View>

        {adminOpen ? <AdminPanel state={state} dispatch={dispatch} onExportPdf={exportPdf} /> : null}
      </ScrollView>

      <SidebarDrawer
        visible={drawerOpen}
        state={state}
        dispatch={dispatch}
        onClose={() => setDrawerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.background
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface
  },
  headerText: {
    flex: 1,
    gap: 3
  },
  appName: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900"
  },
  appMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  headerActions: {
    flexDirection: "row",
    gap: 8
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  iconButtonActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 36
  },
  topControls: {
    gap: 10
  },
  participantArea: {
    gap: 9
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  participantList: {
    gap: 8
  },
  participantChip: {
    maxWidth: 126,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  participantChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  participantChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  participantChipTextActive: {
    color: "#ffffff"
  },
  selectionBar: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface
  },
  selectedRoleLine: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  selectedSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(17, 24, 39, 0.16)"
  },
  selectedRoleTextWrap: {
    flex: 1,
    gap: 2
  },
  selectedRoleLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  selectedRoleName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  canvasHelp: {
    marginTop: -8
  },
  canvasHelpText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16
  },
  markerInspector: {
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSoft
  },
  markerInspectorTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  markerInspectorText: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  deleteButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.danger
  },
  deleteButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800"
  },
  legendSummary: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    backgroundColor: colors.surface
  },
  legendSummaryText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  }
});
