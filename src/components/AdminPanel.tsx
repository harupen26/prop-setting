import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { FileDown, GitMerge, Link, RotateCcw, SquareStack } from "lucide-react-native";

import type { AppAction } from "../state/appReducer";
import type { AppState } from "../types";
import { colors, radius } from "../theme";
import { getActiveCompetition, getActiveParticipant } from "../selectors";

type Props = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onExportPdf: () => void;
};

export function AdminPanel({ state, dispatch, onExportPdf }: Props) {
  const activeCompetition = getActiveCompetition(state);
  const activeParticipant = getActiveParticipant(state);
  const integratedIds = state.integratedParticipantIdsByCompetition[state.activeCompetitionId] ?? [];

  function duplicateCompetition() {
    const baseName = activeCompetition?.name ?? "大会";
    const nextIndex = state.competitions.length + 1;

    dispatch({
      type: "duplicateCompetition",
      competition: {
        id: `competition-${Date.now()}`,
        name: `${baseName}のコピー${nextIndex}`,
        createdAt: new Date().toISOString(),
        copiedFromCompetitionId: state.activeCompetitionId
      }
    });
  }

  function resetData() {
    Alert.alert("初期データに戻しますか？", "端末内の編集内容が初期状態に戻ります。", [
      { text: "キャンセル", style: "cancel" },
      { text: "戻す", style: "destructive", onPress: () => dispatch({ type: "reset" }) }
    ]);
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>管理</Text>
        <Text style={styles.subtitle}>共有・統合・PDF出力</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>大会</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {state.competitions.map((competition) => {
            const active = competition.id === state.activeCompetitionId;
            return (
              <Pressable
                key={competition.id}
                onPress={() => dispatch({ type: "setActiveCompetition", competitionId: competition.id })}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{competition.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable style={styles.actionButton} onPress={duplicateCompetition}>
          <SquareStack size={17} color={colors.text} />
          <Text style={styles.actionText}>大会を複製</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ユーザー名</Text>
        <View style={styles.labelRow}>
          <TextInput
            value={activeParticipant.name}
            onChangeText={(name) =>
              dispatch({
                type: "updateParticipantName",
                participantId: activeParticipant.id,
                name
              })
            }
            placeholder="例: 1. ゆう"
            placeholderTextColor={colors.textMuted}
            style={styles.labelInput}
          />
        </View>
        <Text style={styles.helpText}>
          ここを変えると丸の中の文字も自動で変わります。丸内は最大4文字です。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>秘密リンク</Text>
        <Text style={styles.linkText}>
          {`https://yokohama-robina.local/edit/${activeParticipant.token}`}
        </Text>
        <View style={styles.iconLine}>
          <Link size={16} color={colors.textMuted} />
          <Text style={styles.helpText}>初期版ではリンク形式を表示し、Supabase接続後に実URL化します。</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>統合</Text>
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>出力</Text>
        <Pressable style={styles.primaryButton} onPress={onExportPdf}>
          <FileDown size={18} color="#ffffff" />
          <Text style={styles.primaryButtonText}>PDF出力</Text>
        </Pressable>
        <Pressable style={styles.resetButton} onPress={resetData}>
          <RotateCcw size={16} color={colors.danger} />
          <Text style={styles.resetText}>初期データに戻す</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16
  },
  header: {
    gap: 3
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  section: {
    gap: 10
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  chips: {
    gap: 8
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center"
  },
  chipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700"
  },
  chipTextActive: {
    color: "#ffffff"
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
  actionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  labelInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    color: colors.text,
    fontWeight: "800"
  },
  helpText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16
  },
  linkText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
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
    gap: 8
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
  }
});
