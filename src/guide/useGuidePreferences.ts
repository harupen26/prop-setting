import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import type { GuideMode } from "./guideContent";

const GUIDE_PREFERENCES_KEY = "yokohama-robina-guide-preferences-v1";
const GUIDE_VERSION = 1;

type GuidePreferences = {
  hasSeenIntroTutorial: boolean;
  lastCompletedGuideVersion?: number;
  preferredGuideMode?: GuideMode;
};

const defaultGuidePreferences: GuidePreferences = {
  hasSeenIntroTutorial: false
};

export function useGuidePreferences() {
  const [preferences, setPreferences] = useState<GuidePreferences>(defaultGuidePreferences);
  const [guideHydrated, setGuideHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      try {
        const raw = await AsyncStorage.getItem(GUIDE_PREFERENCES_KEY);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw) as Partial<GuidePreferences>;
        if (!cancelled) {
          setPreferences({
            ...defaultGuidePreferences,
            ...parsed
          });
        }
      } catch {
        if (!cancelled) {
          setPreferences(defaultGuidePreferences);
        }
      } finally {
        if (!cancelled) {
          setGuideHydrated(true);
        }
      }
    }

    loadPreferences();

    return () => {
      cancelled = true;
    };
  }, []);

  async function savePreferences(nextPreferences: GuidePreferences) {
    setPreferences(nextPreferences);
    await AsyncStorage.setItem(GUIDE_PREFERENCES_KEY, JSON.stringify(nextPreferences));
  }

  async function markIntroSeen(preferredGuideMode?: GuideMode) {
    await savePreferences({
      ...preferences,
      hasSeenIntroTutorial: true,
      preferredGuideMode
    });
  }

  async function markGuideCompleted(mode: GuideMode) {
    await savePreferences({
      ...preferences,
      hasSeenIntroTutorial: true,
      preferredGuideMode: mode,
      lastCompletedGuideVersion: GUIDE_VERSION
    });
  }

  return {
    guideHydrated,
    preferences,
    markIntroSeen,
    markGuideCompleted
  };
}
