import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useReducer, useState } from "react";

import { initialAppState } from "../data/seed";
import type { AppState } from "../types";
import { appReducer } from "./appReducer";

const STORAGE_KEY = "yokohama-robina-app-state-v1";

export function usePersistentState() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) {
          return;
        }

        const parsed = JSON.parse(raw) as AppState;
        dispatch({ type: "hydrate", state: parsed });
      })
      .catch(() => {
        // 初回起動や破損データ時は初期データで続行する。
      })
      .finally(() => {
        if (mounted) {
          setHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // 保存失敗時も編集操作は止めない。
    });
  }, [hydrated, state]);

  return { state, dispatch, hydrated };
}
