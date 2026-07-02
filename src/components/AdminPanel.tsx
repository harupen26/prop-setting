import { useMemo, useState, type Dispatch } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  ArrowLeft,
  Copy,
  FileDown,
  GitMerge,
  Link,
  Plus,
  RotateCcw,
  SquareStack,
  Users
} from "lucide-react-native";

import type { AppAction } from "../state/appReducer";
import type { AppState, Competition } from "../types";
import { colors, radius } from "../theme";
import {
  getActiveCompetition,
  getActiveParticipant,
  getActiveProject,
  getProjectCompetitions
} from "../selectors";

type ProjectSettingsProps = {
  visible: boolean;
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onClose: () => void;
  onBackToProjects: () => void;
  onExportPdf: () => void;
};

type ParticipantManagerProps = {
  visible: boolean;
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onClose: () => void;
};

export function ProjectSettingsPanel({
  visible,
  state,
  dispatch,
  onClose,
  onBackToProjects,
  onExportPdf
}: ProjectSettingsProps) {
  const activeProject = getActiveProject(state);
  const activeCompetition = getActiveCompetition(state);
  const projectCompetitions = getProjectCompetitions(state);
  const [duplicateName, setDuplicateName] = useState("");
  const duplicatePlaceholder = useMemo(() => {
    const baseName = activeCompetition?.name ?? "県大会";
    return `${baseName} 更新版`;
  }, [activeCompetition?.name]);

  function duplicateCompetition() {
    if (!activeCompetition) {
      return;
    }

    const name = duplicateName.trim() || duplicatePlaceholder;
    const competition: Competition = {
      id: `competition-${Date.now()}`,
      projectId: activeCompetition.projectId,
      name,
      createdAt: new Date().toISOString(),
      copiedFromCompetitionId: state.activeCompetitionId
    };

    dispatch({ type: "duplicateCompetition", competition });
    setDuplicateName("");
  }

  function resetData() {
    Alert.alert("初期データに戻しますか？", "端末内の編集内容が初期状態に戻ります。", [
      { text: "キャンセル", style: "cancel" },
      { text: "戻す", style: "destructive", onPress: () => dispatch({ type: "reset" }) }
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={onBackToProjects}>
            <ArrowLeft size={18} color={colors.text} />
            <Text style={styles.backButtonText}>プロジェクト一覧に戻る</Text>
          </Pressable>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>閉じる</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>プロジェクト設定</Text>
            <Text style={styles.subtitle}>プロジェクト名とシートのバージョンを管理します。</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>プロジェクト名</Text>
            <TextInput
              value={activeProject?.name ?? ""}
              onChangeText={(name) =>
                activeProject ? dispatch({ type: "updateProjectName", projectId: activeProject.id, name }) : undefined
              }
              placeholder="例: YOKOHAMA ROBINS 2026"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>シート / バージョン</Text>
            <View style={styles.sheetList}>
              {projectCompetitions.map((competition) => {
                const active = competition.id === state.activeCompetitionId;
                return (
                  <View key={competition.id} style={[styles.sheetRow, active && styles.sheetRowActive]}>
                    <Pressable
                      accessibilityLabel={`${competition.name}を開く`}
                      style={[styles.sheetSelect, active && styles.sheetSelectActive]}
                      onPress={() => dispatch({ type: "setActiveCompetition", competitionId: competition.id })}
                    >
                      <Text style={[styles.sheetSelectText, active && styles.sheetSelectTextActive]}>
                        {active ? "開いている" : "開く"}
                      </Text>
                    </Pressable>
                    <TextInput
                      value={competition.name}
                      onChangeText={(name) =>
                        dispatch({ type: "updateCompetitionName", competitionId: competition.id, name })
                      }
                      placeholder="例: 関東大会"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, styles.sheetNameInput]}
                    />
                  </View>
                );
              })}
            </View>

            <View style={styles.inlineForm}>
              <TextInput
                value={duplicateName}
                onChangeText={setDuplicateName}
                placeholder={duplicatePlaceholder}
                placeholderTextColor={colors.textMuted}
                style={styles.inlineInput}
              />
              <Pressable style={styles.actionButton} onPress={duplicateCompetition}>
                <SquareStack size={17} color={colors.text} />
                <Text style={styles.actionText}>コピー作成</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>出力とデータ</Text>
            <Pressable style={styles.primaryButton} onPress={onExportPdf}>
              <FileDown size={18} color="#ffffff" />
              <Text style={styles.primaryButtonText}>PDF出力</Text>
            </Pressable>
            <Pressable style={styles.resetButton} onPress={resetData}>
              <RotateCcw size={16} color={colors.danger} />
              <Text style={styles.resetText}>初期データに戻す</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function ParticipantManagerPanel({ visible, state, dispatch, onClose }: ParticipantManagerProps) {
  const activeProject = getActiveProject(state);
  const activeParticipant = getActiveParticipant(state);
  const integratedIds = state.integratedParticipantIdsByCompetition[state.activeCompetitionId] ?? [];
  const [newParticipantName, setNewParticipantName] = useState("");
  const shareId = activeProject?.shareId ?? "未発行";
  const inviteLink = `propsetting://project/${shareId}`;

  function addParticipant() {
    const name = newParticipantName.trim();
    if (!name) {
      Alert.alert("参加者名を入力してください");
      return;
    }

    dispatch({ type: "addParticipant", name });
    setNewParticipantName("");
  }

  async function copyInviteLink() {
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert("招待リンクをコピーしました", inviteLink);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>
          <View style={styles.topTitleLine}>
            <Users size={20} color={colors.text} />
            <Text style={styles.topTitle}>参加者管理</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>閉じる</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>招待</Text>
            <Text style={styles.linkText}>招待ID: {shareId}</Text>
            <View style={styles.iconLine}>
              <Link size={16} color={colors.textMuted} />
              <Text style={styles.helpText}>
                ホストはこのリンクを共有します。Supabase同期を接続すると、このIDで共同編集に参加できます。
              </Text>
            </View>
            <Pressable style={styles.actionButtonWide} onPress={copyInviteLink}>
              <Copy size={17} color={colors.text} />
              <Text style={styles.actionText}>招待リンクをコピー</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>参加者一覧</Text>
            <View style={styles.participantList}>
              {state.participants
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((participant) => {
                  const active = participant.id === state.activeParticipantId;
                  return (
                    <View key={participant.id} style={[styles.participantRow, active && styles.participantRowActive]}>
                      <Pressable
                        accessibilityLabel={`${participant.name}を編集中にする`}
                        style={[styles.participantNumber, active && styles.participantNumberActive]}
                        onPress={() => dispatch({ type: "setActiveParticipant", participantId: participant.id })}
                      >
                        <Text style={[styles.participantNumberText, active && styles.participantNumberTextActive]}>
                          {participant.order}
                        </Text>
                      </Pressable>
                      <View style={styles.participantInputs}>
                        <TextInput
                          value={participant.name}
                          onChangeText={(name) =>
                            dispatch({ type: "updateParticipantName", participantId: participant.id, name })
                          }
                          placeholder="参加者名"
                          placeholderTextColor={colors.textMuted}
                          style={[styles.input, styles.participantNameInput]}
                        />
                        <TextInput
                          value={participant.markerLabel}
                          onChangeText={(markerLabel) =>
                            dispatch({ type: "updateParticipantLabel", participantId: participant.id, markerLabel })
                          }
                          placeholder="丸内"
                          placeholderTextColor={colors.textMuted}
                          maxLength={4}
                          style={[styles.input, styles.markerInput]}
                        />
                      </View>
                    </View>
                  );
                })}
            </View>

            <View style={styles.inlineForm}>
              <TextInput
                value={newParticipantName}
                onChangeText={setNewParticipantName}
                placeholder="新しい参加者名"
                placeholderTextColor={colors.textMuted}
                style={styles.inlineInput}
              />
              <Pressable style={styles.actionButton} onPress={addParticipant}>
                <Plus size={17} color={colors.text} />
                <Text style={styles.actionText}>追加</Text>
              </Pressable>
            </View>
            <Text style={styles.helpText}>
              名前を変えると丸内ラベルも自動更新されます。丸内だけ変えたい場合は右の欄を編集してください。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>統合表示</Text>
            <View style={styles.statusLine}>
              <Text style={styles.statusText}>
                {integratedIds.length} / {state.participants.length} 人を統合表示
              </Text>
            </View>
            <View style={styles.actionGrid}>
              <Pressable
                style={styles.actionButton}
                onPress={() =>
                  dispatch({
                    type: "integrateParticipant",
                    competitionId: state.activeCompetitionId,
                    participantId: state.activeParticipantId
                  })
                }
              >
                <GitMerge size={17} color={colors.text} />
                <Text style={styles.actionText}>この人を統合</Text>
              </Pressable>
              <Pressable
                style={styles.actionButton}
                onPress={() => dispatch({ type: "integrateAll", competitionId: state.activeCompetitionId })}
              >
                <GitMerge size={17} color={colors.text} />
                <Text style={styles.actionText}>全員を統合</Text>
              </Pressable>
            </View>
            <Text style={styles.helpText}>編集中の参加者: {activeParticipant.name}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  topBar: {
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface
  },
  topTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  topTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  backButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  backButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  closeButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  closeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  content: {
    gap: 18,
    padding: 16,
    paddingBottom: 36
  },
  header: {
    gap: 4
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  section: {
    gap: 10
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    color: colors.text,
    fontWeight: "800",
    backgroundColor: colors.surface
  },
  sheetList: {
    gap: 8
  },
  sheetRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceSoft
  },
  sheetRowActive: {
    borderColor: colors.text
  },
  sheetSelect: {
    minHeight: 36,
    minWidth: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  sheetSelectActive: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  sheetSelectText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  sheetSelectTextActive: {
    color: "#ffffff"
  },
  sheetNameInput: {
    flex: 1
  },
  inlineForm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  inlineInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    color: colors.text,
    fontWeight: "800",
    backgroundColor: colors.surface
  },
  actionButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surface
  },
  actionButtonWide: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surface
  },
  actionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  resetButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  resetText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800"
  },
  helpText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16
  },
  linkText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    backgroundColor: colors.surfaceSoft
  },
  iconLine: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start"
  },
  participantList: {
    gap: 8
  },
  participantRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 8,
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.surfaceSoft
  },
  participantRowActive: {
    borderColor: colors.text
  },
  participantNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  participantNumberActive: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  participantNumberText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  participantNumberTextActive: {
    color: "#ffffff"
  },
  participantInputs: {
    flex: 1,
    flexDirection: "row",
    gap: 8
  },
  participantNameInput: {
    flex: 1
  },
  markerInput: {
    width: 78,
    textAlign: "center"
  },
  statusLine: {
    minHeight: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  statusText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  }
});
