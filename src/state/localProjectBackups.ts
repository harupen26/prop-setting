import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getProjectSyncFingerprint,
  type ProjectSyncPayload
} from "./projectSync";

const STORAGE_KEY = "yokohama-robina-project-backups-v1";
const STORAGE_VERSION = 1;
export const MAX_BACKUPS_PER_PROJECT = 3;
export const MAX_BACKUPS_TOTAL = 8;
export const MAX_BACKUP_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_BACKUP_STORAGE_BYTES = 2_000_000;

export type LocalProjectBackupReason = "before-remote-sync" | "before-restore" | "manual";

export type LocalProjectBackup = {
  id: string;
  shareId: string;
  projectName: string;
  createdAt: string;
  reason: LocalProjectBackupReason;
  fingerprint: string;
  payload: ProjectSyncPayload;
};

type BackupStore = {
  version: typeof STORAGE_VERSION;
  backups: LocalProjectBackup[];
};

let writeQueue: Promise<void> = Promise.resolve();

export function saveLocalProjectBackup(
  payload: ProjectSyncPayload,
  reason: LocalProjectBackupReason
): Promise<void> {
  const operation = writeQueue.then(async () => {
    const current = await readBackupStore();
    const backups = buildNextBackupList(current.backups, payload, reason);

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, backups } satisfies BackupStore)
    );
  });

  writeQueue = operation.catch(() => undefined);
  return operation;
}

export async function getLocalProjectBackups(shareId: string): Promise<LocalProjectBackup[]> {
  await writeQueue;
  const store = await readBackupStore();
  const normalizedShareId = normalizeShareId(shareId);

  return store.backups
    .filter((backup) => normalizeShareId(backup.shareId) === normalizedShareId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function buildNextBackupList(
  current: LocalProjectBackup[],
  payload: ProjectSyncPayload,
  reason: LocalProjectBackupReason,
  createdAt = new Date().toISOString()
): LocalProjectBackup[] {
  const shareId = normalizeShareId(payload.project.shareId);
  const fingerprint = getProjectSyncFingerprint(payload);
  const newestForProject = current
    .filter((backup) => normalizeShareId(backup.shareId) === shareId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (newestForProject?.fingerprint === fingerprint) {
    return pruneBackups(current, new Date(createdAt).getTime());
  }

  const backup: LocalProjectBackup = {
    id: `${shareId}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    shareId,
    projectName: payload.project.name,
    createdAt,
    reason,
    fingerprint,
    payload: {
      ...payload,
      project: {
        ...payload.project,
        shareId
      }
    }
  };

  return pruneBackups([backup, ...current], new Date(createdAt).getTime());
}

function pruneBackups(backups: LocalProjectBackup[], now: number): LocalProjectBackup[] {
  const cutoff = now - MAX_BACKUP_AGE_MS;
  const countsByProject = new Map<string, number>();
  const retained = backups
    .filter((backup) => {
      const timestamp = new Date(backup.createdAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((backup) => {
      const shareId = normalizeShareId(backup.shareId);
      const count = countsByProject.get(shareId) ?? 0;
      if (count >= MAX_BACKUPS_PER_PROJECT) {
        return false;
      }

      countsByProject.set(shareId, count + 1);
      return true;
    })
    .slice(0, MAX_BACKUPS_TOTAL);

  while (retained.length > 1 && estimateStorageBytes(retained) > MAX_BACKUP_STORAGE_BYTES) {
    retained.pop();
  }

  return retained;
}

async function readBackupStore(): Promise<BackupStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyStore();
    }

    const parsed = JSON.parse(raw) as Partial<BackupStore>;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.backups)) {
      return emptyStore();
    }

    return {
      version: STORAGE_VERSION,
      backups: parsed.backups.filter(isLocalProjectBackup)
    };
  } catch {
    return emptyStore();
  }
}

function isLocalProjectBackup(value: unknown): value is LocalProjectBackup {
  if (!value || typeof value !== "object") {
    return false;
  }

  const backup = value as Partial<LocalProjectBackup>;
  return (
    typeof backup.id === "string" &&
    typeof backup.shareId === "string" &&
    typeof backup.projectName === "string" &&
    typeof backup.createdAt === "string" &&
    typeof backup.fingerprint === "string" &&
    (backup.reason === "before-remote-sync" || backup.reason === "before-restore" || backup.reason === "manual") &&
    !!backup.payload
  );
}

function estimateStorageBytes(backups: LocalProjectBackup[]): number {
  return JSON.stringify(backups).length * 2;
}

function emptyStore(): BackupStore {
  return { version: STORAGE_VERSION, backups: [] };
}

function normalizeShareId(shareId: string): string {
  return shareId.trim().toUpperCase();
}
