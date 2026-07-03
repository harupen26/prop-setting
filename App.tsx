import { type Dispatch, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Eye,
  FileDown,
  HelpCircle,
  LogIn,
  Plus,
  Settings,
  Trash2,
  Users
} from "lucide-react-native";

import { ParticipantManagerPanel, ProjectSettingsPanel } from "./src/components/AdminPanel";
import { DrillCanvas } from "./src/components/DrillCanvas";
import { SegmentedControl } from "./src/components/SegmentedControl";
import { SidebarDrawer } from "./src/components/SidebarDrawer";
import { GuideIntroPrompt, HelpPanel } from "./src/guide/HelpPanel";
import { GuideOverlay, GuideProvider, GuideTarget } from "./src/guide/GuideOverlay";
import { getGuideSteps, type GuideMode, type GuideStep } from "./src/guide/guideContent";
import { useGuidePreferences } from "./src/guide/useGuidePreferences";
import {
  buildPdfHtml,
  defaultPdfExportOptions,
  getPdfTargetLabel,
  type PdfExportOptions,
  type PdfPhaseOption,
  type PdfTargetMode
} from "./src/domain/pdf";
import { SNAP, clamp } from "./src/domain/grid";
import type { AppAction } from "./src/state/appReducer";
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

type GuideUiSnapshot = {
  canvasInteractionLocked: boolean;
  drawerOpen: boolean;
  fineAdjustMode: boolean;
  participantManagerOpen: boolean;
  pdfOptionsOpen: boolean;
  projectListOpen: boolean;
  projectSettingsOpen: boolean;
  selectedMarkerId: string | undefined;
};

const GUIDE_ADVANCE_DELAY_MS = 320;

export default function App() {
  return (
    <GuideProvider>
      <AppShell />
    </GuideProvider>
  );
}

function AppShell() {
  const { state, dispatch, hydrated } = usePersistentState();
  const { preferences, guideHydrated, markIntroSeen, markGuideCompleted } = useGuidePreferences();
  const guideStateSnapshotRef = useRef<AppState | undefined>(undefined);
  const guideUiSnapshotRef = useRef<GuideUiSnapshot | undefined>(undefined);
  const guideAdvanceLockedRef = useRef(false);
  const mainScrollRef = useRef<ScrollView | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectListOpen, setProjectListOpen] = useState(true);
  const [participantManagerOpen, setParticipantManagerOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [activeGuideMode, setActiveGuideMode] = useState<GuideMode | undefined>();
  const [guideIndex, setGuideIndex] = useState(0);
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
  const guideSteps = useMemo(() => (activeGuideMode ? getGuideSteps(activeGuideMode) : []), [activeGuideMode]);
  const currentGuideStep = guideSteps[guideIndex];
  const activeGuideTargetId =
    currentGuideStep?.advanceOnTargetPress && currentGuideStep.targetId ? currentGuideStep.targetId : undefined;

  useEffect(() => {
    if (!hydrated || !guideHydrated || preferences.hasSeenIntroTutorial || activeGuideMode) {
      return;
    }

    setIntroOpen(true);
  }, [activeGuideMode, guideHydrated, hydrated, preferences.hasSeenIntroTutorial]);

  useEffect(() => {
    if (!activeGuideMode || projectListOpen) {
      return undefined;
    }

    const targetId = currentGuideStep?.targetId;
    if (!targetId) {
      return undefined;
    }

    const first = setTimeout(() => {
      if (targetId === "marker-nudge-controls") {
        setCanvasInteractionLocked(false);
        mainScrollRef.current?.scrollToEnd({ animated: true });
        return;
      }

      if (
        targetId === "phase-tabs" ||
        targetId === "view-mode-tabs" ||
        targetId === "participant-list" ||
        targetId === "role-select"
      ) {
        mainScrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    }, 220);

    const second = setTimeout(() => {
      if (targetId === "marker-nudge-controls") {
        mainScrollRef.current?.scrollToEnd({ animated: true });
      }
    }, 620);

    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [activeGuideMode, currentGuideStep?.targetId, projectListOpen, selectedMarkerId]);

  function placeMarker(xSnap: number, ySnap: number) {
    if (!selectedRole) {
      return;
    }

    const markerId = `marker-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dispatch({
      type: "placeMarker",
      marker: {
        id: markerId,
        competitionId: state.activeCompetitionId,
        participantId: state.activeParticipantId,
        roleId: selectedRole.id,
        phase: state.activePhase,
        xSnap,
        ySnap,
        updatedAt: new Date().toISOString()
      }
    });
    setSelectedMarkerId(markerId);
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
    setPdfOptionsOpen(false);
    setDrawerOpen(false);
    setSelectedMarkerId(undefined);
  }

  function closeSecondaryPanels() {
    setDrawerOpen(false);
    setParticipantManagerOpen(false);
    setProjectSettingsOpen(false);
    setPdfOptionsOpen(false);
  }

  function prepareGuideStep(step: GuideStep | undefined) {
    if (!step) {
      return;
    }

    setCanvasInteractionLocked(false);

    if (step.screen === "projectList") {
      setProjectListOpen(true);
      closeSecondaryPanels();
      return;
    }

    setProjectListOpen(false);

    if (step.screen === "participantManager") {
      setDrawerOpen(false);
      setProjectSettingsOpen(false);
      setPdfOptionsOpen(false);
      setParticipantManagerOpen(true);
      return;
    }

    if (step.screen === "sidebar") {
      setParticipantManagerOpen(false);
      setProjectSettingsOpen(false);
      setPdfOptionsOpen(false);
      setDrawerOpen(true);
      return;
    }

    if (step.screen === "projectSettings") {
      setDrawerOpen(false);
      setParticipantManagerOpen(false);
      setPdfOptionsOpen(false);
      setProjectSettingsOpen(true);
      return;
    }

    if (step.screen === "pdf") {
      setDrawerOpen(false);
      setParticipantManagerOpen(false);
      setProjectSettingsOpen(false);
      openPdfOptions();
      return;
    }

    closeSecondaryPanels();
  }

  function startGuide(mode: GuideMode) {
    const nextSteps = getGuideSteps(mode);
    guideStateSnapshotRef.current = cloneAppState(state);
    guideUiSnapshotRef.current = {
      canvasInteractionLocked,
      drawerOpen,
      fineAdjustMode,
      participantManagerOpen,
      pdfOptionsOpen,
      projectListOpen,
      projectSettingsOpen,
      selectedMarkerId
    };
    guideAdvanceLockedRef.current = false;
    setHelpOpen(false);
    setIntroOpen(false);
    setActiveGuideMode(mode);
    setGuideIndex(0);
    void markIntroSeen(mode);
    prepareGuideStep(nextSteps[0]);
  }

  function stopGuide(completed: boolean) {
    if (completed && activeGuideMode) {
      void markGuideCompleted(activeGuideMode);
    }

    const stateSnapshot = guideStateSnapshotRef.current;
    const uiSnapshot = guideUiSnapshotRef.current;
    if (stateSnapshot) {
      dispatch({ type: "hydrate", state: stateSnapshot });
    }
    if (uiSnapshot) {
      setCanvasInteractionLocked(uiSnapshot.canvasInteractionLocked);
      setDrawerOpen(uiSnapshot.drawerOpen);
      setFineAdjustMode(uiSnapshot.fineAdjustMode);
      setParticipantManagerOpen(uiSnapshot.participantManagerOpen);
      setPdfOptionsOpen(uiSnapshot.pdfOptionsOpen);
      setProjectListOpen(uiSnapshot.projectListOpen);
      setProjectSettingsOpen(uiSnapshot.projectSettingsOpen);
      setSelectedMarkerId(uiSnapshot.selectedMarkerId);
    }
    guideStateSnapshotRef.current = undefined;
    guideUiSnapshotRef.current = undefined;
    guideAdvanceLockedRef.current = false;
    setActiveGuideMode(undefined);
    setGuideIndex(0);
  }

  function scheduleNextGuideStep() {
    if (guideAdvanceLockedRef.current) {
      return;
    }

    guideAdvanceLockedRef.current = true;
    setTimeout(() => {
      guideAdvanceLockedRef.current = false;
      showNextGuideStep();
    }, GUIDE_ADVANCE_DELAY_MS);
  }

  function completeGuideTarget(targetId: GuideStep["targetId"]) {
    if (!targetId || activeGuideTargetId !== targetId) {
      return;
    }

    scheduleNextGuideStep();
  }

  function completeGuideStep(stepId: string) {
    if (currentGuideStep?.id !== stepId) {
      return;
    }

    scheduleNextGuideStep();
  }

  function showNextGuideStep() {
    const nextIndex = guideIndex + 1;
    if (nextIndex >= guideSteps.length) {
      stopGuide(true);
      return;
    }

    setGuideIndex(nextIndex);
    prepareGuideStep(guideSteps[nextIndex]);
  }

  function showPreviousGuideStep() {
    guideAdvanceLockedRef.current = false;
    const nextIndex = Math.max(0, guideIndex - 1);
    setGuideIndex(nextIndex);
    prepareGuideStep(guideSteps[nextIndex]);
  }

  function dismissIntroPrompt() {
    setIntroOpen(false);
    void markIntroSeen();
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

  const renderGuideOverlay = (embedded = false) => (
    <GuideOverlay
      visible={!!activeGuideMode}
      step={currentGuideStep}
      stepIndex={guideIndex}
      stepCount={guideSteps.length}
      onNext={showNextGuideStep}
      onBack={showPreviousGuideStep}
      onSkip={() => stopGuide(false)}
      embedded={embedded}
      practiceMode={!!activeGuideMode}
    />
  );
  const guideOverlay = renderGuideOverlay(false);
  const embeddedGuideOverlay = renderGuideOverlay(true);
  const guideOverlayInSidebar = currentGuideStep?.screen === "sidebar" && drawerOpen;
  const guideOverlayInProjectAction = isProjectActionGuideTarget(currentGuideStep?.targetId);
  const guideOverlayInParticipantManager = currentGuideStep?.screen === "participantManager" && participantManagerOpen;
  const guideOverlayInProjectSettings = currentGuideStep?.screen === "projectSettings" && projectSettingsOpen;
  const guideOverlayInPdf = currentGuideStep?.screen === "pdf" && pdfOptionsOpen;
  const guideOverlayInEmbeddedModal =
    guideOverlayInSidebar ||
    guideOverlayInProjectAction ||
    guideOverlayInParticipantManager ||
    guideOverlayInProjectSettings ||
    guideOverlayInPdf;
  const guideLayers = (
    <>
      <HelpPanel visible={helpOpen} onClose={() => setHelpOpen(false)} onStartGuide={startGuide} />
      <GuideIntroPrompt
        visible={introOpen && !activeGuideMode}
        onStartGuide={startGuide}
        onDismiss={dismissIntroPrompt}
      />
      {guideOverlayInEmbeddedModal ? null : guideOverlay}
    </>
  );

  if (!hydrated || !guideHydrated) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.text} />
        <Text style={styles.loadingText}>読み込み中</Text>
      </SafeAreaView>
    );
  }

  if (projectListOpen) {
    return (
      <View style={styles.appFrame}>
        <ProjectListScreen
          state={state}
          dispatch={dispatch}
          onOpenProject={openProject}
          onOpenHelp={() => setHelpOpen(true)}
          onGuideTargetPress={completeGuideTarget}
          guideOverlay={guideOverlayInProjectAction ? embeddedGuideOverlay : undefined}
        />
        {guideLayers}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.appName} numberOfLines={1}>手具セット管理</Text>
          <Text style={styles.appMeta} numberOfLines={1}>
            {activeProject?.name ?? "プロジェクト未設定"} / {activeCompetition?.name ?? "シート未設定"} / {activeParticipant.name}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <GuideTarget targetId="main-help">
            <Pressable accessibilityLabel="使い方ガイドを開く" style={styles.iconButton} onPress={() => setHelpOpen(true)}>
              <HelpCircle size={20} color={colors.text} />
            </Pressable>
          </GuideTarget>
          <GuideTarget targetId="participant-manager-button">
            <Pressable
              accessibilityLabel="参加者管理を開く"
              style={styles.iconButton}
              onPress={() => {
                setParticipantManagerOpen(true);
                completeGuideTarget("participant-manager-button");
              }}
            >
              <Users size={20} color={colors.text} />
            </Pressable>
          </GuideTarget>
          <GuideTarget targetId="pdf-button">
            <Pressable
              accessibilityLabel="PDF出力"
              style={styles.iconButton}
              onPress={() => {
                openPdfOptions();
                completeGuideTarget("pdf-button");
              }}
            >
              <FileDown size={20} color={colors.text} />
            </Pressable>
          </GuideTarget>
          <GuideTarget targetId="project-settings-button">
            <Pressable
              accessibilityLabel="プロジェクト設定を開く"
              style={styles.iconButton}
              onPress={() => {
                setProjectSettingsOpen(true);
                completeGuideTarget("project-settings-button");
              }}
            >
              <Settings size={20} color={colors.text} />
            </Pressable>
          </GuideTarget>
        </View>
      </View>

      <ScrollView
        ref={mainScrollRef}
        contentContainerStyle={styles.content}
        scrollEnabled={!canvasInteractionLocked}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topControls}>
          <GuideTarget targetId="phase-tabs">
            <SegmentedControl<Phase>
              value={state.activePhase}
              options={[
                { value: "entry", label: "入場" },
                { value: "exit", label: "退場" }
              ]}
              onChange={(phase) => {
                setSelectedMarkerId(undefined);
                dispatch({ type: "setPhase", phase });
                completeGuideTarget("phase-tabs");
              }}
            />
          </GuideTarget>
          <GuideTarget targetId="view-mode-tabs">
            <SegmentedControl<ViewMode>
              value={state.viewMode}
              options={[
                { value: "participant", label: "編集中" },
                { value: "master", label: "統合表示" }
              ]}
              onChange={(viewMode) => {
                setSelectedMarkerId(undefined);
                dispatch({ type: "setViewMode", viewMode });
                completeGuideTarget("view-mode-tabs");
              }}
            />
          </GuideTarget>
        </View>

        <GuideTarget targetId="participant-list">
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
                      completeGuideTarget("participant-list");
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
        </GuideTarget>

        <GuideTarget targetId="role-select">
          <View style={styles.selectionBar}>
            <View style={styles.selectedRoleLine}>
              <View style={[styles.selectedSwatch, { backgroundColor: selectedRole?.color ?? colors.border }]} />
              <View style={styles.selectedRoleTextWrap}>
                <Text style={styles.selectedRoleLabel}>配置する手具</Text>
                <Text style={styles.selectedRoleName}>{selectedRole?.name ?? "未選択"}</Text>
              </View>
            </View>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setDrawerOpen(true);
                completeGuideTarget("role-select");
              }}
            >
              <Text style={styles.secondaryButtonText}>変更</Text>
            </Pressable>
          </View>
        </GuideTarget>

        <GuideTarget targetId="drill-canvas">
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
            onGuidePlace={() => completeGuideStep("member-drill")}
            onGuideMove={() => completeGuideStep("member-drag-marker")}
            onGuideZoomButton={() => completeGuideStep("member-zoom-buttons")}
            onGuideZoomGesture={() => completeGuideStep("member-zoom-gesture")}
          />
        </GuideTarget>

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
              <GuideTarget targetId="marker-nudge-controls" style={styles.nudgePad}>
                <View style={styles.nudgePadLine}>
                  <NudgeButton label="上へ" onPress={() => {
                    nudgeSelectedMarker(0, -nudgeStep);
                    completeGuideStep("member-nudge-marker");
                  }}>
                    <ArrowUp size={17} color={colors.text} />
                  </NudgeButton>
                </View>
                <View style={styles.nudgePadLine}>
                  <NudgeButton label="左へ" onPress={() => {
                    nudgeSelectedMarker(-nudgeStep, 0);
                    completeGuideStep("member-nudge-marker");
                  }}>
                    <ArrowLeft size={17} color={colors.text} />
                  </NudgeButton>
                  <NudgeButton label="下へ" onPress={() => {
                    nudgeSelectedMarker(0, nudgeStep);
                    completeGuideStep("member-nudge-marker");
                  }}>
                    <ArrowDown size={17} color={colors.text} />
                  </NudgeButton>
                  <NudgeButton label="右へ" onPress={() => {
                    nudgeSelectedMarker(nudgeStep, 0);
                    completeGuideStep("member-nudge-marker");
                  }}>
                    <ArrowRight size={17} color={colors.text} />
                  </NudgeButton>
                </View>
              </GuideTarget>
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
        onGuideTargetPress={completeGuideTarget}
        guideOverlay={guideOverlayInSidebar ? embeddedGuideOverlay : undefined}
      />
      <ParticipantManagerPanel
        visible={participantManagerOpen}
        state={state}
        dispatch={dispatch}
        onClose={() => setParticipantManagerOpen(false)}
        guideOverlay={guideOverlayInParticipantManager ? embeddedGuideOverlay : undefined}
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
        guideOverlay={guideOverlayInProjectSettings ? embeddedGuideOverlay : undefined}
      />
      <PdfOptionsModal
        visible={pdfOptionsOpen}
        state={state}
        options={pdfOptions}
        onChange={setPdfOptions}
        onClose={() => setPdfOptionsOpen(false)}
        onSave={() => exportPdf(pdfOptions)}
        guideOverlay={guideOverlayInPdf ? embeddedGuideOverlay : undefined}
      />
      {guideLayers}
    </SafeAreaView>
  );
}

function ProjectListScreen({
  state,
  dispatch,
  onOpenProject,
  onOpenHelp,
  onGuideTargetPress,
  guideOverlay
}: {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onOpenProject: (projectId: string) => void;
  onOpenHelp: () => void;
  onGuideTargetPress: (targetId: GuideStep["targetId"]) => void;
  guideOverlay?: ReactNode;
}) {
  const [actionOpen, setActionOpen] = useState(false);
  const [actionMode, setActionMode] = useState<"create" | "join">("create");
  const [projectName, setProjectName] = useState("");
  const [createInviteId, setCreateInviteId] = useState(() => generateInviteId(""));
  const [joinInviteId, setJoinInviteId] = useState("");

  function openProjectAction() {
    setActionMode("create");
    setProjectName("");
    setCreateInviteId(generateInviteId(""));
    setJoinInviteId("");
    setActionOpen(true);
    onGuideTargetPress("project-add");
  }

  function isDuplicateInviteId(inviteId: string) {
    return state.projects.some((project) => project.shareId.toLowerCase() === inviteId.toLowerCase());
  }

  async function copyCreateInviteId() {
    if (!isInviteIdValid(createInviteId)) {
      Alert.alert("招待IDを確認してください", INVITE_ID_HELP);
      return;
    }

    await Clipboard.setStringAsync(createInviteId);
    Alert.alert("招待IDをコピーしました", createInviteId);
  }

  function createProject() {
    const name = projectName.trim();
    const shareId = createInviteId.trim();
    if (!name) {
      Alert.alert("プロジェクト名を入力してください");
      return;
    }
    if (!isInviteIdValid(shareId)) {
      Alert.alert("招待IDを確認してください", INVITE_ID_HELP);
      return;
    }
    if (isDuplicateInviteId(shareId)) {
      Alert.alert("この招待IDはすでに使われています", "別の招待IDを設定してください。");
      return;
    }

    const now = new Date().toISOString();
    const projectId = `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const competitionId = `competition-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    dispatch({
      type: "createProject",
      project: {
        id: projectId,
        name,
        shareId,
        createdAt: now
      },
      competition: {
        id: competitionId,
        projectId,
        name: "県大会",
        createdAt: now
      }
    });
    setActionOpen(false);
    onOpenProject(projectId);
  }

  function joinProject() {
    const shareId = joinInviteId.trim();
    if (!isInviteIdValid(shareId)) {
      Alert.alert("招待IDを確認してください", INVITE_ID_HELP);
      return;
    }

    const existingProject = state.projects.find(
      (project) => project.shareId.toLowerCase() === shareId.toLowerCase()
    );
    if (existingProject) {
      setActionOpen(false);
      onOpenProject(existingProject.id);
      onGuideTargetPress("project-join-submit");
      return;
    }

    const now = new Date().toISOString();
    const projectId = `project-joined-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const competitionId = `competition-joined-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    dispatch({
      type: "joinProject",
      project: {
        id: projectId,
        name: `参加プロジェクト ${shareId}`,
        shareId,
        createdAt: now
      },
      competition: {
        id: competitionId,
        projectId,
        name: "共有シート",
        createdAt: now
      }
    });
    setActionOpen(false);
    onOpenProject(projectId);
    onGuideTargetPress("project-join-submit");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.projectListContent} showsVerticalScrollIndicator={false}>
        <View style={styles.projectListHeader}>
          <View style={styles.projectListHeaderTop}>
            <View style={styles.projectListTitleBlock}>
              <Text style={styles.projectListTitle}>プロジェクト</Text>
              <Text style={styles.projectListSubtitle}>編集するプロジェクトを選んでください。</Text>
            </View>
            <GuideTarget targetId="main-help">
              <Pressable accessibilityLabel="使い方ガイドを開く" style={styles.iconButton} onPress={onOpenHelp}>
                <HelpCircle size={20} color={colors.text} />
              </Pressable>
            </GuideTarget>
          </View>
        </View>

        <View style={styles.projectCards}>
          {state.projects.map((project, index) => {
            const sheets = state.competitions.filter((competition) => competition.projectId === project.id);
            const active = project.id === state.activeProjectId;
            const openButton = (
              <Pressable
                style={styles.projectOpenButton}
                onPress={() => {
                  onOpenProject(project.id);
                  onGuideTargetPress("project-open");
                }}
              >
                <Text style={styles.projectOpenText}>開く</Text>
              </Pressable>
            );

            return (
              <View key={project.id} style={[styles.projectCard, active && styles.projectCardActive]}>
                <View style={styles.projectCardTop}>
                  <View style={styles.projectCardText}>
                    <Text style={styles.projectCardTitle}>{project.name}</Text>
                    <Text style={styles.projectCardMeta}>
                      {sheets.length}シート / 招待ID {project.shareId}
                    </Text>
                  </View>
                  {index === 0 ? <GuideTarget targetId="project-open">{openButton}</GuideTarget> : openButton}
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
      <GuideTarget targetId="project-add" style={styles.projectFabTarget}>
        <Pressable accessibilityLabel="プロジェクトを追加" style={styles.projectFab} onPress={openProjectAction}>
          <Plus size={24} color="#ffffff" />
        </Pressable>
      </GuideTarget>

      <Modal visible={actionOpen} transparent animationType="fade" onRequestClose={() => setActionOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setActionOpen(false)} />
          <View style={styles.projectActionPanel}>
            <View style={styles.projectActionHeader}>
              <Text style={styles.projectActionTitle}>プロジェクトを追加</Text>
              <Text style={styles.projectActionSubtitle}>作成するか、招待IDで参加します。</Text>
            </View>

            <GuideTarget targetId="project-action-mode">
              <SegmentedControl<"create" | "join">
                value={actionMode}
                options={[
                  { value: "create", label: "作成" },
                  { value: "join", label: "参加" }
                ]}
                onChange={(mode) => {
                  setActionMode(mode);
                  if (mode === "join") {
                    onGuideTargetPress("project-action-mode");
                  }
                }}
              />
            </GuideTarget>

            {actionMode === "create" ? (
              <View style={styles.projectActionSection}>
                <Text style={styles.projectActionLabel}>プロジェクト名</Text>
                <TextInput
                  value={projectName}
                  onChangeText={setProjectName}
                  placeholder="例: YOKOHAMA ROBINS 2026"
                  placeholderTextColor={colors.textMuted}
                  style={styles.projectActionInput}
                />
                <Text style={styles.projectActionLabel}>招待ID</Text>
                <View style={styles.inviteInputRow}>
                  <TextInput
                    value={createInviteId}
                    onChangeText={(value) => setCreateInviteId(formatInviteIdInput(value))}
                    placeholder="YRCG2025"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    style={[styles.projectActionInput, styles.inviteInput]}
                  />
                  <Pressable
                    accessibilityLabel="招待IDを自動作成"
                    style={styles.projectSmallButton}
                    onPress={() => setCreateInviteId(generateInviteId(projectName))}
                  >
                    <Text style={styles.projectSmallButtonText}>自動</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="招待IDをコピー"
                    style={styles.projectIconButton}
                    onPress={copyCreateInviteId}
                  >
                    <Copy size={17} color={colors.text} />
                  </Pressable>
                </View>
                <Text style={styles.projectActionHelp}>{INVITE_ID_HELP}</Text>
                <View style={styles.projectActionButtons}>
                  <Pressable style={styles.projectCancelButton} onPress={() => setActionOpen(false)}>
                    <Text style={styles.projectCancelText}>キャンセル</Text>
                  </Pressable>
                  <Pressable style={styles.projectPrimaryButton} onPress={createProject}>
                    <Plus size={17} color="#ffffff" />
                    <Text style={styles.projectPrimaryText}>作成</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.projectActionSection}>
                <Text style={styles.projectActionLabel}>招待ID</Text>
                <GuideTarget targetId="project-join-invite-input">
                  <TextInput
                    value={joinInviteId}
                    onChangeText={(value) => {
                      const formatted = formatInviteIdInput(value);
                      setJoinInviteId(formatted);
                      if (formatted === SAMPLE_INVITE_ID) {
                        Keyboard.dismiss();
                        onGuideTargetPress("project-join-invite-input");
                      }
                    }}
                    placeholder="招待IDを入力"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    style={styles.projectActionInput}
                  />
                </GuideTarget>
                <Text style={styles.projectActionHelp}>{INVITE_ID_HELP}</Text>
                <View style={styles.projectActionButtons}>
                  <Pressable style={styles.projectCancelButton} onPress={() => setActionOpen(false)}>
                    <Text style={styles.projectCancelText}>キャンセル</Text>
                  </Pressable>
                  <GuideTarget targetId="project-join-submit">
                    <Pressable style={styles.projectPrimaryButton} onPress={joinProject}>
                      <LogIn size={17} color="#ffffff" />
                      <Text style={styles.projectPrimaryText}>参加</Text>
                    </Pressable>
                  </GuideTarget>
                </View>
              </View>
            )}
          </View>
          {guideOverlay}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const INVITE_ID_HELP = "使える文字: 半角英数字・ハイフン(-)・アンダーバー(_) / 3〜24文字";
const INVITE_ID_PATTERN = /^[A-Z0-9_-]{3,24}$/;
const SAMPLE_INVITE_ID = "YRCG2025";

function formatInviteIdInput(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase().slice(0, 24);
}

function isInviteIdValid(value: string): boolean {
  return INVITE_ID_PATTERN.test(value);
}

function generateInviteId(seed: string): string {
  const base = formatInviteIdInput(seed).replace(/^[-_]+|[-_]+$/g, "").slice(0, 12) || "PROJECT";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`.slice(0, 24);
}

function isProjectActionGuideTarget(targetId: GuideStep["targetId"]): boolean {
  return (
    targetId === "project-action-mode" ||
    targetId === "project-join-invite-input" ||
    targetId === "project-join-submit"
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
  onSave,
  guideOverlay
}: {
  visible: boolean;
  state: ReturnType<typeof usePersistentState>["state"];
  options: PdfExportOptions;
  onChange: (options: PdfExportOptions) => void;
  onClose: () => void;
  onSave: () => void;
  guideOverlay?: ReactNode;
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

          <GuideTarget targetId="pdf-target">
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
          </GuideTarget>

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
            <GuideTarget targetId="pdf-save">
              <Pressable style={styles.pdfSaveButton} onPress={onSave}>
                <FileDown size={18} color="#ffffff" />
                <Text style={styles.pdfSaveText}>保存</Text>
              </Pressable>
            </GuideTarget>
          </View>
        </View>
        {guideOverlay}
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

function cloneAppState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
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
    position: "relative",
    backgroundColor: colors.background
  },
  appFrame: {
    flex: 1,
    position: "relative",
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
  projectListHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  projectListTitleBlock: {
    flex: 1,
    gap: 5
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
  projectFabTarget: {
    position: "absolute",
    right: 18,
    bottom: 22
  },
  projectFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  projectActionPanel: {
    width: "100%",
    maxWidth: 460,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 16,
    backgroundColor: colors.surface
  },
  projectActionHeader: {
    gap: 4
  },
  projectActionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  projectActionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  projectActionSection: {
    gap: 9
  },
  projectActionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  projectActionInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    backgroundColor: colors.surface
  },
  inviteInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  inviteInput: {
    flex: 1
  },
  projectSmallButton: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  projectSmallButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  projectIconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  projectActionHelp: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  projectActionButtons: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8
  },
  projectCancelButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  projectCancelText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  projectPrimaryButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary
  },
  projectPrimaryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
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
    flexShrink: 0,
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
    position: "relative",
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
