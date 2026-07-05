import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Dispatch, useEffect, useRef, useState } from "react";

import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AppState } from "../types";
import type { AppAction } from "./appReducer";
import {
  buildProjectSyncPayload,
  getActiveProjectShareId,
  getProjectSyncFingerprint,
  isProjectSyncPayload,
  mergeProjectSyncPayload,
  type ProjectSyncPayload
} from "./projectSync";

const CLIENT_ID_STORAGE_KEY = "yokohama-robina-sync-client-id-v1";
const SAVE_DELAY_MS = 650;
const SYNC_STATUS_RESET_MS = 700;

type ProjectSnapshotRow = {
  share_id: string;
  payload: unknown;
  updated_at: string;
  updated_by: string | null;
};

export type ProjectSyncStatus = "local" | "connecting" | "synced" | "saving" | "receiving" | "paused" | "error";

export type ProjectSyncInfo = {
  status: ProjectSyncStatus;
  label: string;
  error?: string;
};

type Options = {
  hydrated: boolean;
  paused?: boolean;
};

export function useProjectRealtimeSync(
  state: AppState,
  dispatch: Dispatch<AppAction>,
  options: Options
): ProjectSyncInfo {
  const [clientId, setClientId] = useState<string | undefined>();
  const [syncInfo, setSyncInfo] = useState<ProjectSyncInfo>(() => getSyncInfo("local"));
  const stateRef = useRef(state);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const readyShareIdRef = useRef<string | undefined>(undefined);
  const applyingRemoteRef = useRef(false);
  const lastFingerprintRef = useRef<string | undefined>(undefined);
  const lastSeenUpdatedAtRef = useRef<string | undefined>(undefined);
  const activeShareId = getActiveProjectShareId(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(CLIENT_ID_STORAGE_KEY)
      .then(async (storedClientId) => {
        if (storedClientId) {
          return storedClientId;
        }

        const nextClientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem(CLIENT_ID_STORAGE_KEY, nextClientId);
        return nextClientId;
      })
      .then((nextClientId) => {
        if (mounted) {
          setClientId(nextClientId);
        }
      })
      .catch(() => {
        if (mounted) {
          setClientId(`client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      setSyncInfo(getSyncInfo("local"));
      return undefined;
    }

    if (!options.hydrated || !clientId || !activeShareId) {
      setSyncInfo(getSyncInfo("connecting"));
      return undefined;
    }

    if (options.paused) {
      setSyncInfo(getSyncInfo("paused"));
      return undefined;
    }

    let cancelled = false;
    const syncClient = client;
    const shareId = activeShareId;
    const syncClientId = clientId;
    readyShareIdRef.current = undefined;
    lastSeenUpdatedAtRef.current = undefined;
    setSyncInfo(getSyncInfo("connecting"));

    function applyRemoteRow(row: ProjectSnapshotRow, applyOptions: { includeOwnUpdate?: boolean } = {}) {
      if (
        cancelled ||
        (!applyOptions.includeOwnUpdate && row.updated_by === syncClientId) ||
        !isProjectSyncPayload(row.payload)
      ) {
        return;
      }

      if (lastSeenUpdatedAtRef.current && row.updated_at <= lastSeenUpdatedAtRef.current) {
        return;
      }

      lastSeenUpdatedAtRef.current = row.updated_at;
      applyingRemoteRef.current = true;
      lastFingerprintRef.current = getProjectSyncFingerprint(row.payload);
      setSyncInfo(getSyncInfo("receiving"));
      dispatch({ type: "hydrate", state: mergeProjectSyncPayload(stateRef.current, row.payload) });
      scheduleSyncedStatus();
    }

    const channel = syncClient
      .channel(`project-sync:${shareId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_snapshots",
          filter: `share_id=eq.${shareId}`
        },
        (event) => {
          const row = event.new as ProjectSnapshotRow | undefined;
          if (row) {
            applyRemoteRow(row);
          }
        }
      )
      .subscribe();

    async function loadInitialSnapshot() {
      const { data, error } = await syncClient
        .from("project_snapshots")
        .select("share_id,payload,updated_at,updated_by")
        .eq("share_id", shareId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        setSyncInfo(getSyncInfo("error", error.message));
        return;
      }

      readyShareIdRef.current = shareId;

      if (data?.payload && isProjectSyncPayload(data.payload)) {
        applyRemoteRow(data as ProjectSnapshotRow, { includeOwnUpdate: true });
        setSyncInfo(getSyncInfo("synced"));
        return;
      }

      const payload = buildProjectSyncPayload(stateRef.current);
      if (payload) {
        await saveSnapshot(shareId, payload, syncClientId);
        lastFingerprintRef.current = getProjectSyncFingerprint(payload);
      }
      setSyncInfo(getSyncInfo("synced"));
    }

    void loadInitialSnapshot().catch((error: unknown) => {
      if (!cancelled) {
        setSyncInfo(getSyncInfo("error", error instanceof Error ? error.message : "DB同期に失敗しました"));
      }
    });

    return () => {
      cancelled = true;
      readyShareIdRef.current = undefined;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      void syncClient.removeChannel(channel);
    };
  }, [activeShareId, clientId, dispatch, options.hydrated, options.paused]);

  useEffect(() => {
    if (
      !isSupabaseConfigured ||
      !supabase ||
      !options.hydrated ||
      !clientId ||
      !activeShareId ||
      options.paused ||
      readyShareIdRef.current !== activeShareId
    ) {
      return undefined;
    }

    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return undefined;
    }

    const payload = buildProjectSyncPayload(state);
    if (!payload) {
      return undefined;
    }

    const fingerprint = getProjectSyncFingerprint(payload);
    if (fingerprint === lastFingerprintRef.current) {
      return undefined;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      const nextPayload = buildProjectSyncPayload(stateRef.current);
      if (!nextPayload) {
        return;
      }

      setSyncInfo(getSyncInfo("saving"));
      void saveSnapshot(activeShareId, nextPayload, clientId)
        .then(() => {
          lastFingerprintRef.current = getProjectSyncFingerprint(nextPayload);
          setSyncInfo(getSyncInfo("synced"));
        })
        .catch((error: unknown) => {
          setSyncInfo(getSyncInfo("error", error instanceof Error ? error.message : "DB保存に失敗しました"));
        });
    }, SAVE_DELAY_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [activeShareId, clientId, options.hydrated, options.paused, state]);

  function scheduleSyncedStatus() {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = setTimeout(() => {
      setSyncInfo(getSyncInfo("synced"));
    }, SYNC_STATUS_RESET_MS);
  }

  return syncInfo;
}

async function saveSnapshot(shareId: string, payload: ProjectSyncPayload, clientId: string) {
  if (!supabase) {
    return;
  }

  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from("project_snapshots").upsert(
    {
      share_id: shareId,
      payload: {
        ...payload,
        updatedAt
      },
      updated_at: updatedAt,
      updated_by: clientId
    },
    { onConflict: "share_id" }
  );

  if (error) {
    throw error;
  }
}

function getSyncInfo(status: ProjectSyncStatus, error?: string): ProjectSyncInfo {
  switch (status) {
    case "connecting":
      return { status, label: "DB同期: 接続中" };
    case "synced":
      return { status, label: "DB同期: 最新" };
    case "saving":
      return { status, label: "DB同期: 保存中" };
    case "receiving":
      return { status, label: "DB同期: 受信中" };
    case "paused":
      return { status, label: "DB同期: 一時停止" };
    case "error":
      return { status, label: "DB同期: 要確認", error };
    case "local":
    default:
      return { status: "local", label: "DB同期: 未設定" };
  }
}
