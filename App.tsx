import { type ReactNode, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eye,
  FileDown,
  Settings,
  Trash2,
  Users
} from "lucide-react-native";

import { ParticipantManagerPanel, ProjectSettingsPanel } from "./src/components/AdminPanel";
import { DrillCanvas } from "./src/components/DrillCanvas";
import { SegmentedControl } from "./src/components/SegmentedControl";
import { SidebarDrawer } from "./src/components/SidebarDrawer";
import {
  buildPdfHtml,
  defaultPdfExportOptions,
  getPdfTargetLabel,
  type PdfExportOptions,
  type PdfPhaseOption,
  type PdfTargetMode
} from "./src/domain/pdf";
import { SNAP, clamp } from "./src/domain/grid";
import { usePersistentState } from "./src/state/usePersistentState";
import { colors, radius } from "./src/theme";
import type { AppState, Phase, ViewMode } from "./src/types";
import {
  getActiveCompetition,
  getActiveParticipant,
  getActiveProject,
  getSelectedRole,
  getVisibleMarkers,
  isRoleVisible
} from "./src/selectors";
import { isSupabaseConfigured } from "./src/lib/supabase";

export default function App() {
  const { state, dispatch, hydrated } = usePersistentState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectListOpen, setProjectListOpen] = useState(true);
  const [participantManagerOpen, setParticipantManagerOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | undefined>();
  const [canvasInteractionLocked, setCanvasInteractionLocked] = useState(false);
  const [fineAdjustMode, setFineAdjustMode] = useState(false);
  const [pdfOptionsOpen, setPdfOptionsOpen] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>({
    ...defaultPdfExportOptions,
    participantId: undefined
  });
  const activeCompetition = getActiveCompetition(state);
  const activeProject = getActiveProject(state);
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

  async function exportPdf(options: PdfExportOptions) {
    try {
      const normalizedOptions = normalizePdfOptions(options, state.activeParticipantId);
      const html = buildPdfHtml(state, normalizedOptions);
      if (Platform.OS === "web") {
        const { downloadDrillPdf } = await import("./src/domain/pdfWeb");
        await downloadDrillPdf(state, normalizedOptions);
        setPdfOptionsOpen(false);
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
      setPdfOptionsOpen(false);
    } catch (error) {
      Alert.alert("PDF出力に失敗しました", error instanceof Error ? error.message : "もう一度お試しください。");
    }
  }

  function openPdfOptions() {
    setPdfOptions((current) => ({
      ...current,
      participantId: current.participantId ?? state.activeParticipantId
    }));
    setPdfOptionsOpen(true);
  }

  function openProject(projectId: string) {
    dispatch({ type: "setActiveProject", projectId });
    setProjectListOpen(false);
    setParticipantManagerOpen(false);
    setProjectSettingsOpen(false);
    setSelectedMarkerId(undefined);
  }

  const selectedMarker = state.markers.find((marker) => marker.id === selectedMarkerId);
  const nudgeStep = fineAdjustMode ? 1 : SNAP.fineStep;

  function nudgeSelectedMarker(dxSnap: number, dySnap: number) {
    if (!selectedMarker) {
      return;
    }

    dispatch({
      type: "moveMarker",
      markerId: selectedMarker.id,
      xSnap: clamp(selectedMarker.xSnap + dxSnap, 0, SNAP.xMax),
      ySnap: clamp(selectedMarker.ySnap + dySnap, 0, SNAP.yMax)
    });
  }

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.text} />
        <Text style={styles.loadingText}>読み込み中</Text>
      </SafeAreaView>
    );
  }

  if (projectListOpen) {
    return <ProjectListScreen state={state} onOpenProject={openProject} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.appName}>手具セット管理</Text>
          <Text style={styles.appMeta}>
            {activeProject?.name ?? "プロジェクト未設定"} / {activeCompetition?.name ?? "シート未設定"} / {activeParticipant.name}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="参加者管理を開く"
            style={styles.iconButton}
            onPress={() => setParticipantManagerOpen(true)}
          >
            <Users size={20} color={colors.text} />
          </Pressable>
          <Pressable accessibilityLabel="PDF出力" style={styles.iconButton} onPress={openPdfOptions}>
            <FileDown size={20} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="プロジェクト設定を開く"
            style={styles.iconButton}
            onPress={() => setProjectSettingsOpen(true)}
          >
            <Settings size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        scrollEnabled={!canvasInteractionLocked}
        showsVerticalScrollIndicator={false}
      >
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
          onInteractionLockChange={setCanvasInteractionLocked}
        />

        <View style={styles.canvasHelp}>
          <Text style={styles.canvasHelpText}>
            タップで配置、丸をドラッグで移動。選択中は矢印で位置調整できます。
          </Text>
        </View>

        {selectedMarker ? (
          <View style={styles.markerInspector}>
            <View style={styles.markerInspectorTop}>
              <View>
                <Text style={styles.markerInspectorTitle}>選択中の丸</Text>
                <Text style={styles.markerInspectorText}>
                  横 {selectedMarker.xSnap} / 縦 {selectedMarker.ySnap}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="細かい調整に切り替え"
                style={[styles.fineToggle, fineAdjustMode && styles.fineToggleActive]}
                onPress={() => setFineAdjustMode((value) => !value)}
              >
                <Text style={[styles.fineToggleText, fineAdjustMode && styles.fineToggleTextActive]}>
                  {fineAdjustMode ? "0.5歩" : "1歩"}
                </Text>
              </Pressable>
            </View>
            <View style={styles.adjustRow}>
              <View style={styles.nudgePad}>
                <View style={styles.nudgePadLine}>
                  <NudgeButton label="上へ" onPress={() => nudgeSelectedMarker(0, -nudgeStep)}>
                    <ArrowUp size={17} color={colors.text} />
                  </NudgeButton>
                </View>
                <View style={styles.nudgePadLine}>
                  <NudgeButton label="左へ" onPress={() => nudgeSelectedMarker(-nudgeStep, 0)}>
                    <ArrowLeft size={17} color={colors.text} />
                  </NudgeButton>
                  <NudgeButton label="下へ" onPress={() => nudgeSelectedMarker(0, nudgeStep)}>
                    <ArrowDown size={17} color={colors.text} />
                  </NudgeButton>
                  <NudgeButton label="右へ" onPress={() => nudgeSelectedMarker(nudgeStep, 0)}>
                    <ArrowRight size={17} color={colors.text} />
                  </NudgeButton>
                </View>
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

      </ScrollView>

      <SidebarDrawer
        visible={drawerOpen}
        state={state}
        dispatch={dispatch}
        onClose={() => setDrawerOpen(false)}
      />
      <ParticipantManagerPanel
        visible={participantManagerOpen}
        state={state}
        dispatch={dispatch}
        onClose={() => setParticipantManagerOpen(false)}
      />
      <ProjectSettingsPanel
        visible={projectSettingsOpen}
        state={state}
        dispatch={dispatch}
        onClose={() => setProjectSettingsOpen(false)}
        onBackToProjects={() => {
          setProjectSettingsOpen(false);
          setProjectListOpen(true);
        }}
        onExportPdf={openPdfOptions}
      />
      <PdfOptionsModal
        visible={pdfOptionsOpen}
        state={state}
        options={pdfOptions}
        onChange={setPdfOptions}
        onClose={() => setPdfOptionsOpen(false)}
        onSave={() => exportPdf(pdfOptions)}
      />
    </SafeAreaView>
  );
}

function ProjectListScreen({
  state,
  onOpenProject
}: {
  state: AppState;
  onOpenProject: (projectId: string) => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.projectListContent} showsVerticalScrollIndicator={false}>
        <View style={styles.projectListHeader}>
          <Text style={styles.projectListTitle}>プロジェクト</Text>
          <Text style={styles.projectListSubtitle}>編集するプロジェクトを選んでください。</Text>
        </View>

        <View style={styles.projectCards}>
          {state.projects.map((project) => {
            const sheets = state.competitions.filter((competition) => competition.projectId === project.id);
            const active = project.id === state.activeProjectId;
            return (
              <View key={project.id} style={[styles.projectCard, active && styles.projectCardActive]}>
                <View style={styles.projectCardTop}>
                  <View style={styles.projectCardText}>
                    <Text style={styles.projectCardTitle}>{project.name}</Text>
                    <Text style={styles.projectCardMeta}>
                      {sheets.length}シート / 招待ID {project.shareId}
                    </Text>
                  </View>
                  <Pressable style={styles.projectOpenButton} onPress={() => onOpenProject(project.id)}>
                    <Text style={styles.projectOpenText}>開く</Text>
                  </Pressable>
                </View>
                <View style={styles.projectSheetPreview}>
                  {sheets.map((sheet) => (
                    <Text key={sheet.id} style={styles.projectSheetPill} numberOfLines={1}>
                      {sheet.name}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function normalizePdfOptions(options: PdfExportOptions, fallbackParticipantId: string): PdfExportOptions {
  if (options.targetMode === "participant") {
    return {
      ...options,
      participantId: options.participantId ?? fallbackParticipantId
    };
  }

  return {
    targetMode: "master",
    phaseOption: options.phaseOption
  };
}

function PdfOptionsModal({
  visible,
  state,
  options,
  onChange,
  onClose,
  onSave
}: {
  visible: boolean;
  state: ReturnType<typeof usePersistentState>["state"];
  options: PdfExportOptions;
  onChange: (options: PdfExportOptions) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const selectedParticipantId = options.participantId ?? state.activeParticipantId;
  const targetLabel = getPdfTargetLabel(state, normalizePdfOptions(options, state.activeParticipantId));

  function setTargetMode(targetMode: PdfTargetMode) {
    onChange({
      ...options,
      targetMode,
      participantId: targetMode === "participant" ? selectedParticipantId : options.participantId
    });
  }

  function setPhaseOption(phaseOption: PdfPhaseOption) {
    onChange({ ...options, phaseOption });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.pdfPanel}>
          <View style={styles.pdfPanelHeader}>
            <Text style={styles.pdfPanelTitle}>PDF出力</Text>
            <Text style={styles.pdfPanelSubtitle}>対象とシートを選択</Text>
          </View>

          <View style={styles.pdfSection}>
            <Text style={styles.pdfSectionTitle}>出力対象</Text>
            <View style={styles.optionRow}>
              <OptionButton
                active={options.targetMode === "master"}
                label="統合表示"
                onPress={() => setTargetMode("master")}
              />
              <OptionButton
                active={options.targetMode === "participant"}
                label="参加者別"
                onPress={() => setTargetMode("participant")}
              />
            </View>
          </View>

          {options.targetMode === "participant" ? (
            <View style={styles.pdfSection}>
              <Text style={styles.pdfSectionTitle}>参加者</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pdfChips}>
                {state.participants.map((participant) => {
                  const active = participant.id === selectedParticipantId;
                  return (
                    <Pressable
                      key={participant.id}
                      onPress={() => onChange({ ...options, participantId: participant.id })}
                      style={[styles.pdfChip, active && styles.pdfChipActive]}
                    >
                      <Text style={[styles.pdfChipText, active && styles.pdfChipTextActive]} numberOfLines={1}>
                        {participant.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.pdfSection}>
            <Text style={styles.pdfSectionTitle}>シート</Text>
            <View style={styles.optionRow}>
              <OptionButton active={options.phaseOption === "entry"} label="入場" onPress={() => setPhaseOption("entry")} />
              <OptionButton active={options.phaseOption === "exit"} label="退場" onPress={() => setPhaseOption("exit")} />
              <OptionButton active={options.phaseOption === "both"} label="両方" onPress={() => setPhaseOption("both")} />
            </View>
          </View>

          <Text style={styles.pdfSummary}>{targetLabel} / {phaseOptionLabel(options.phaseOption)}</Text>

          <View style={styles.pdfActions}>
            <Pressable style={styles.pdfCancelButton} onPress={onClose}>
              <Text style={styles.pdfCancelText}>キャンセル</Text>
            </Pressable>
            <Pressable style={styles.pdfSaveButton} onPress={onSave}>
              <FileDown size={18} color="#ffffff" />
              <Text style={styles.pdfSaveText}>保存</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function OptionButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.optionButton, active && styles.optionButtonActive]} onPress={onPress}>
      <Text style={[styles.optionButtonText, active && styles.optionButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function phaseOptionLabel(option: PdfPhaseOption): string {
  if (option === "entry") {
    return "入場";
  }

  if (option === "exit") {
    return "退場";
  }

  return "入場・退場";
}

function NudgeButton({
  children,
  label,
  onPress
}: {
  children: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={label} style={styles.nudgeButton} onPress={onPress}>
      {children}
    </Pressable>
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
  projectListContent: {
    gap: 18,
    padding: 16,
    paddingBottom: 36
  },
  projectListHeader: {
    gap: 5,
    paddingTop: 6
  },
  projectListTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  projectListSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  projectCards: {
    gap: 12
  },
  projectCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 12,
    backgroundColor: colors.surface
  },
  projectCardActive: {
    borderColor: colors.borderStrong
  },
  projectCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  projectCardText: {
    flex: 1,
    gap: 4
  },
  projectCardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  projectCardMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  projectOpenButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  projectOpenText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  },
  projectSheetPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  projectSheetPill: {
    maxWidth: 148,
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: "hidden",
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: colors.surfaceSoft
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
    gap: 10,
    backgroundColor: colors.surfaceSoft
  },
  markerInspectorTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
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
  fineToggle: {
    minHeight: 34,
    minWidth: 66,
    paddingHorizontal: 10,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  fineToggleActive: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  fineToggleText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  fineToggleTextActive: {
    color: "#ffffff"
  },
  adjustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  nudgePad: {
    width: 120,
    alignItems: "center",
    gap: 6
  },
  nudgePadLine: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6
  },
  nudgeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
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
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(15, 23, 42, 0.24)"
  },
  modalBackdrop: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0
  },
  pdfPanel: {
    width: "100%",
    maxWidth: 440,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 16,
    backgroundColor: colors.surface
  },
  pdfPanelHeader: {
    gap: 3
  },
  pdfPanelTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  pdfPanelSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  pdfSection: {
    gap: 8
  },
  pdfSectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  optionButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  optionButtonActive: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  optionButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  optionButtonTextActive: {
    color: "#ffffff"
  },
  pdfChips: {
    gap: 8
  },
  pdfChip: {
    maxWidth: 132,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  pdfChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  pdfChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  pdfChipTextActive: {
    color: "#ffffff"
  },
  pdfSummary: {
    minHeight: 34,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: colors.surfaceSoft
  },
  pdfActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8
  },
  pdfCancelButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  pdfCancelText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  pdfSaveButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary
  },
  pdfSaveText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  }
});
