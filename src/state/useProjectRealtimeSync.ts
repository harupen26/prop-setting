import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Dispatch, useEffect, useRef, useState } from "react";

import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AppState } from "../types";
import type { AppAction } from "./appReducer";
import { saveLocalProjectBackup } from "./localProjectBackups";
import {
  buildProjectSyncPayload,
  getActiveProjectShareId,
  getProjectSyncFingerprint,
  isProjectSyncPayload,
  mergeConcurrentProjectSyncPayload,
  mergeProjectSyncPayload,
  type ProjectSyncPayload
} from "./projectSync";

const CLIENT_ID_STORAGE_KEY = "yokohama-robina-sync-client-id-v1";
const SAVE_DELAY_MS = 650;
const SYNC_STATUS_RESET_MS = 700;
const RECONCILE_INTERVAL_MS = 5000;
const MAX_SAVE_ATTEMPTS = 30;

type ProjectSnapshotRow = {
  share_id: string;
  payload: ProjectSyncPayload;
  updated_at: string;
  updated_by: string | null;
};

type SnapshotBase = {
  payload?: ProjectSyncPayload;
  updatedAt?: string;
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
  const basePayloadRef = useRef<ProjectSyncPayload | undefined>(undefined);
  const baseUpdatedAtRef = useRef<string | undefined>(undefined);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
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
    basePayloadRef.current = undefined;
    baseUpdatedAtRef.current = undefined;
    lastFingerprintRef.current = undefined;
    setSyncInfo(getSyncInfo("connecting"));

    let remoteApplyQueue = Promise.resolve();

    async function applyRemoteRow(
      row: ProjectSnapshotRow,
      applyOptions: { includeOwnUpdate?: boolean } = {}
    ) {
      if (cancelled || (!applyOptions.includeOwnUpdate && row.updated_by === syncClientId)) {
        return;
      }

      if (
        row.updated_at === baseUpdatedAtRef.current &&
        getProjectSyncFingerprint(row.payload) === getProjectSyncFingerprint(basePayloadRef.current ?? row.payload)
      ) {
        return;
      }

      const currentPayload = buildProjectSyncPayload(stateRef.current);
      if (
        currentPayload &&
        getProjectSyncFingerprint(currentPayload) !== getProjectSyncFingerprint(row.payload)
      ) {
        await saveLocalProjectBackup(currentPayload, "before-remote-sync").catch(() => undefined);
      }

      if (cancelled) {
        return;
      }

      const mergedPayload =
        currentPayload && basePayloadRef.current
          ? mergeConcurrentProjectSyncPayload(basePayloadRef.current, currentPayload, row.payload)
          : row.payload;
      const remoteFingerprint = getProjectSyncFingerprint(row.payload);
      const mergedFingerprint = getProjectSyncFingerprint(mergedPayload);

      basePayloadRef.current = row.payload;
      baseUpdatedAtRef.current = row.updated_at;
      lastFingerprintRef.current = remoteFingerprint;
      applyingRemoteRef.current = mergedFingerprint === remoteFingerprint;
      setSyncInfo(getSyncInfo("receiving"));
      dispatch({ type: "hydrate", state: mergeProjectSyncPayload(stateRef.current, mergedPayload) });
      if (mergedFingerprint === remoteFingerprint) {
        scheduleSyncedStatus();
      } else {
        setSyncInfo(getSyncInfo("saving"));
      }
    }

    function enqueueRemoteRow(
      row: ProjectSnapshotRow,
      applyOptions: { includeOwnUpdate?: boolean } = {}
    ) {
      remoteApplyQueue = remoteApplyQueue
        .then(() => applyRemoteRow(row, applyOptions))
        .catch((error: unknown) => {
          if (!cancelled) {
            setSyncInfo(getSyncInfo("error", error instanceof Error ? error.message : "DB同期に失敗しました"));
          }
        });

      return remoteApplyQueue;
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
          const row = parseSnapshotRow(event.new);
          if (row) {
            void enqueueRemoteRow(row);
          }
        }
      )
      .subscribe();
    let reconcileRunning = false;
    const reconcileTimer = setInterval(() => {
      if (cancelled || reconcileRunning) {
        return;
      }

      reconcileRunning = true;
      void loadSnapshot(shareId)
        .then((row) => {
          if (row && row.updated_at !== baseUpdatedAtRef.current) {
            return enqueueRemoteRow(row, { includeOwnUpdate: true });
          }
          return undefined;
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setSyncInfo(getSyncInfo("error", error instanceof Error ? error.message : "DB同期に失敗しました"));
          }
        })
        .finally(() => {
          reconcileRunning = false;
        });
    }, RECONCILE_INTERVAL_MS);

    async function loadInitialSnapshot() {
      const row = await loadSnapshot(shareId);

      if (cancelled) {
        return;
      }

      readyShareIdRef.current = shareId;

      if (row) {
        await enqueueRemoteRow(row, { includeOwnUpdate: true });
        setSyncInfo(getSyncInfo("synced"));
        return;
      }

      const payload = buildProjectSyncPayload(stateRef.current);
      if (payload) {
        const savedRow = await saveSnapshot(shareId, payload, syncClientId);
        basePayloadRef.current = savedRow.payload;
        baseUpdatedAtRef.current = savedRow.updated_at;
        lastFingerprintRef.current = getProjectSyncFingerprint(savedRow.payload);
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
      if (readyShareIdRef.current === shareId) {
        readyShareIdRef.current = undefined;
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      clearInterval(reconcileTimer);
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

    const shareId = activeShareId;
    const syncClientId = clientId;
    saveTimerRef.current = setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          if (readyShareIdRef.current !== shareId) {
            return;
          }

          const nextPayload = buildProjectSyncPayload(stateRef.current);
          if (
            !nextPayload ||
            getProjectSyncFingerprint(nextPayload) === lastFingerprintRef.current
          ) {
            return;
          }

          const base: SnapshotBase = {
            payload: basePayloadRef.current,
            updatedAt: baseUpdatedAtRef.current
          };
          setSyncInfo(getSyncInfo("saving"));
          const savedRow = await saveSnapshot(shareId, nextPayload, syncClientId, base);

          if (readyShareIdRef.current !== shareId) {
            return;
          }

          const latestLocalPayload = buildProjectSyncPayload(stateRef.current);
          const mergedCurrentPayload = latestLocalPayload
            ? mergeConcurrentProjectSyncPayload(nextPayload, latestLocalPayload, savedRow.payload)
            : savedRow.payload;
          const savedFingerprint = getProjectSyncFingerprint(savedRow.payload);
          const mergedFingerprint = getProjectSyncFingerprint(mergedCurrentPayload);

          basePayloadRef.current = savedRow.payload;
          baseUpdatedAtRef.current = savedRow.updated_at;
          lastFingerprintRef.current = savedFingerprint;
          applyingRemoteRef.current = mergedFingerprint === savedFingerprint;
          dispatch({
            type: "hydrate",
            state: mergeProjectSyncPayload(stateRef.current, mergedCurrentPayload)
          });
          setSyncInfo(getSyncInfo(mergedFingerprint === savedFingerprint ? "synced" : "saving"));
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
  }, [activeShareId, clientId, dispatch, options.hydrated, options.paused, state]);

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

async function saveSnapshot(
  shareId: string,
  payload: ProjectSyncPayload,
  clientId: string,
  base: SnapshotBase = {}
): Promise<ProjectSnapshotRow> {
  if (!supabase) {
    throw new Error("DB接続が設定されていません");
  }

  let candidatePayload = payload;
  let basePayload = base.payload;
  let expectedUpdatedAt = base.updatedAt;

  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt += 1) {
    const updatedAt = createMonotonicTimestamp(expectedUpdatedAt, attempt);
    const nextPayload = { ...candidatePayload, updatedAt };
    const values = {
      share_id: shareId,
      payload: nextPayload,
      updated_at: updatedAt,
      updated_by: clientId
    };

    if (expectedUpdatedAt) {
      const { data, error } = await supabase
        .from("project_snapshots")
        .update(values)
        .eq("share_id", shareId)
        .eq("updated_at", expectedUpdatedAt)
        .select("share_id,payload,updated_at,updated_by")
        .maybeSingle();

      if (error) {
        throw error;
      }

      const savedRow = parseSnapshotRow(data);
      if (savedRow) {
        return savedRow;
      }
    } else {
      const { data, error } = await supabase
        .from("project_snapshots")
        .insert(values)
        .select("share_id,payload,updated_at,updated_by")
        .maybeSingle();

      if (!error) {
        const savedRow = parseSnapshotRow(data);
        if (savedRow) {
          return savedRow;
        }
      } else if (error.code !== "23505") {
        throw error;
      }
    }

    const latestRow = await loadSnapshot(shareId);
    if (!latestRow) {
      expectedUpdatedAt = undefined;
      continue;
    }

    const mergeBase = basePayload ?? latestRow.payload;
    candidatePayload = mergeConcurrentProjectSyncPayload(
      mergeBase,
      candidatePayload,
      latestRow.payload
    );
    basePayload = latestRow.payload;
    expectedUpdatedAt = latestRow.updated_at;
    await waitBeforeRetry(attempt);
  }

  throw new Error("同時編集が集中しています。少し待ってからもう一度操作してください");
}

async function loadSnapshot(shareId: string): Promise<ProjectSnapshotRow | undefined> {
  if (!supabase) {
    return undefined;
  }

  const { data, error } = await supabase
    .from("project_snapshots")
    .select("share_id,payload,updated_at,updated_by")
    .eq("share_id", shareId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseSnapshotRow(data);
}

function parseSnapshotRow(value: unknown): ProjectSnapshotRow | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const row = value as Partial<ProjectSnapshotRow>;
  if (
    typeof row.share_id !== "string" ||
    typeof row.updated_at !== "string" ||
    !isProjectSyncPayload(row.payload)
  ) {
    return undefined;
  }

  return {
    share_id: row.share_id,
    payload: row.payload,
    updated_at: row.updated_at,
    updated_by: typeof row.updated_by === "string" ? row.updated_by : null
  };
}

function createMonotonicTimestamp(previous: string | undefined, attempt: number): string {
  const previousTime = previous ? Date.parse(previous) : 0;
  const nextTime = Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0) + attempt;
  return new Date(nextTime).toISOString();
}

function waitBeforeRetry(attempt: number): Promise<void> {
  const maxJitter = Math.min(250, 50 * (attempt + 1));
  const delay = 25 + Math.round(Math.random() * maxJitter);
  return new Promise((resolve) => setTimeout(resolve, delay));
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
