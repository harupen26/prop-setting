import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { BookOpen, HelpCircle, PlayCircle, X } from "lucide-react-native";

import { colors, radius } from "../theme";
import { helpSections, type GuideMode } from "./guideContent";

export function HelpPanel({
  visible,
  onClose,
  onStartGuide
}: {
  visible: boolean;
  onClose: () => void;
  onStartGuide: (mode: GuideMode) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>
          <View style={styles.topTitleLine}>
            <HelpCircle size={20} color={colors.text} />
            <Text style={styles.topTitle}>使い方ガイド</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <X size={18} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>迷ったらここから確認できます</Text>
            <Text style={styles.heroText}>
              初めての人はチュートリアルを開始すると、実際のボタンを吹き出しで案内します。
            </Text>
          </View>

          <View style={styles.guideButtons}>
            <Pressable style={styles.primaryGuideButton} onPress={() => onStartGuide("member")}>
              <PlayCircle size={18} color="#ffffff" />
              <Text style={styles.primaryGuideText}>メンバー向けチュートリアル</Text>
            </Pressable>
            <Pressable style={styles.secondaryGuideButton} onPress={() => onStartGuide("admin")}>
              <PlayCircle size={18} color={colors.text} />
              <Text style={styles.secondaryGuideText}>管理者向けチュートリアル</Text>
            </Pressable>
          </View>

          {helpSections.map((section) => (
            <View key={section.id} style={styles.section}>
              <View style={styles.sectionTitleLine}>
                <BookOpen size={17} color={colors.text} />
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              {section.body.map((line) => (
                <Text key={line} style={styles.sectionText}>
                  {line}
                </Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function GuideIntroPrompt({
  visible,
  onStartGuide,
  onDismiss
}: {
  visible: boolean;
  onStartGuide: (mode: GuideMode) => void;
  onDismiss: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.introOverlay}>
        <View style={styles.introPanel}>
          <Text style={styles.introTitle}>使い方を見ますか？</Text>
          <Text style={styles.introText}>
            初めて使う人向けに、実際のボタンを吹き出しで案内します。あとからヘルプでも見直せます。
          </Text>
          <View style={styles.introActions}>
            <Pressable style={styles.primaryGuideButton} onPress={() => onStartGuide("member")}>
              <Text style={styles.primaryGuideText}>メンバー向けで始める</Text>
            </Pressable>
            <Pressable style={styles.secondaryGuideButton} onPress={() => onStartGuide("admin")}>
              <Text style={styles.secondaryGuideText}>管理者向けで始める</Text>
            </Pressable>
            <Pressable style={styles.laterButton} onPress={onDismiss}>
              <Text style={styles.laterText}>あとで</Text>
            </Pressable>
          </View>
        </View>
      </View>
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
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 36
  },
  hero: {
    gap: 5
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  heroText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  guideButtons: {
    gap: 8
  },
  primaryGuideButton: {
    minHeight: 42,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary
  },
  primaryGuideText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryGuideButton: {
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surface
  },
  secondaryGuideText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 7,
    backgroundColor: colors.surface
  },
  sectionTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  sectionText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700"
  },
  introOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(15, 23, 42, 0.32)"
  },
  introPanel: {
    width: "100%",
    maxWidth: 430,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface
  },
  introTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900"
  },
  introText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  introActions: {
    gap: 8
  },
  laterButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center"
  },
  laterText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800"
  }
});
