import { initialAppState } from "../data/seed";
import type {
  AppState,
  ApparatusRole,
  Competition,
  Marker,
  Participant,
  Project,
  RoleFolder
} from "../types";

export const PROJECT_SYNC_VERSION = 1;

export type ProjectSyncPayload = {
  version: typeof PROJECT_SYNC_VERSION;
  project: Project;
  competitions: Competition[];
  participants: Participant[];
  folders: RoleFolder[];
  roles: ApparatusRole[];
  markers: Marker[];
  integratedParticipantIdsByCompetition: Record<string, string[]>;
  updatedAt: string;
};

export function getActiveProjectShareId(state: AppState): string | undefined {
  const project = state.projects.find((item) => item.id === state.activeProjectId);
  return project?.shareId ? normalizeShareId(project.shareId) : undefined;
}

export function buildProjectSyncPayload(
  state: AppState,
  updatedAt = new Date().toISOString()
): ProjectSyncPayload | undefined {
  const project = state.projects.find((item) => item.id === state.activeProjectId);
  if (!project) {
    return undefined;
  }

  const competitions = state.competitions.filter((competition) => competition.projectId === project.id);
  const competitionIds = new Set(competitions.map((competition) => competition.id));
  const integratedParticipantIdsByCompetition = Object.fromEntries(
    Object.entries(state.integratedParticipantIdsByCompetition).filter(([competitionId]) =>
      competitionIds.has(competitionId)
    )
  );

  return {
    version: PROJECT_SYNC_VERSION,
    project: {
      ...project,
      shareId: normalizeShareId(project.shareId)
    },
    competitions,
    participants: state.participants,
    folders: state.folders,
    roles: state.roles,
    markers: state.markers.filter((marker) => competitionIds.has(marker.competitionId)),
    integratedParticipantIdsByCompetition,
    updatedAt
  };
}

export function getProjectSyncFingerprint(payload: ProjectSyncPayload): string {
  return stableSerialize({
    ...payload,
    updatedAt: ""
  });
}

export function mergeConcurrentProjectSyncPayload(
  base: ProjectSyncPayload,
  local: ProjectSyncPayload,
  remote: ProjectSyncPayload,
  updatedAt = new Date().toISOString()
): ProjectSyncPayload {
  const project = mergeRecordFields(base.project, local.project, remote.project);
  const competitions = mergeEntityCollections(
    base.competitions,
    local.competitions,
    remote.competitions,
    (competition) => competition.id,
    mergeRecordFields
  );
  const participants = mergeEntityCollections(
    base.participants,
    local.participants,
    remote.participants,
    (participant) => participant.id,
    mergeRecordFields
  );
  const folders = mergeEntityCollections(
    base.folders,
    local.folders,
    remote.folders,
    (folder) => folder.id,
    mergeRecordFields
  );
  const roles = mergeEntityCollections(
    base.roles,
    local.roles,
    remote.roles,
    (role) => role.id,
    mergeRecordFields
  );
  const markers = mergeEntityCollections(
    base.markers,
    local.markers,
    remote.markers,
    getMarkerSlotKey
  );
  const integratedParticipantIdsByCompetition = mergeRecordValues(
    base.integratedParticipantIdsByCompetition,
    local.integratedParticipantIdsByCompetition,
    remote.integratedParticipantIdsByCompetition
  );
  const competitionIds = new Set(competitions.map((competition) => competition.id));
  const participantIds = new Set(participants.map((participant) => participant.id));
  const roleIds = new Set(roles.map((role) => role.id));

  return {
    version: PROJECT_SYNC_VERSION,
    project,
    competitions,
    participants,
    folders,
    roles,
    markers: markers.filter(
      (marker) =>
        competitionIds.has(marker.competitionId) &&
        participantIds.has(marker.participantId) &&
        roleIds.has(marker.roleId)
    ),
    integratedParticipantIdsByCompetition: Object.fromEntries(
      Object.entries(integratedParticipantIdsByCompetition)
        .filter(([competitionId]) => competitionIds.has(competitionId))
        .map(([competitionId, integratedParticipantIds]) => [
          competitionId,
          integratedParticipantIds.filter((participantId) => participantIds.has(participantId))
        ])
    ),
    updatedAt
  };
}

export function mergeProjectSyncPayload(current: AppState, payload: ProjectSyncPayload): AppState {
  const incomingProject = {
    ...payload.project,
    shareId: normalizeShareId(payload.project.shareId)
  };
  const incomingShareId = incomingProject.shareId.toLowerCase();
  const matchingProjectIds = new Set(
    current.projects
      .filter(
        (project) =>
          project.id === incomingProject.id || normalizeShareId(project.shareId).toLowerCase() === incomingShareId
      )
      .map((project) => project.id)
  );
  matchingProjectIds.add(incomingProject.id);

  const removedCompetitionIds = new Set(
    current.competitions
      .filter((competition) => matchingProjectIds.has(competition.projectId))
      .map((competition) => competition.id)
  );
  const incomingCompetitionIds = new Set(payload.competitions.map((competition) => competition.id));
  const activeProjectMatches = matchingProjectIds.has(current.activeProjectId);

  const projects = [
    ...current.projects.filter(
      (project) =>
        !matchingProjectIds.has(project.id) && normalizeShareId(project.shareId).toLowerCase() !== incomingShareId
    ),
    incomingProject
  ];
  const competitions = [
    ...current.competitions.filter(
      (competition) =>
        !matchingProjectIds.has(competition.projectId) && !incomingCompetitionIds.has(competition.id)
    ),
    ...payload.competitions
  ];
  const markers = [
    ...current.markers.filter(
      (marker) =>
        !removedCompetitionIds.has(marker.competitionId) && !incomingCompetitionIds.has(marker.competitionId)
    ),
    ...payload.markers
  ];
  const integratedParticipantIdsByCompetition = {
    ...Object.fromEntries(
      Object.entries(current.integratedParticipantIdsByCompetition).filter(
        ([competitionId]) =>
          !removedCompetitionIds.has(competitionId) && !incomingCompetitionIds.has(competitionId)
      )
    ),
    ...payload.integratedParticipantIdsByCompetition
  };
  const participants = payload.participants.length ? payload.participants : current.participants;
  const folders = payload.folders.length ? payload.folders : current.folders;
  const roles = payload.roles;
  const nextActiveProjectId = activeProjectMatches ? incomingProject.id : current.activeProjectId;
  const activeCompetitionStillExists = competitions.some(
    (competition) => competition.id === current.activeCompetitionId
  );
  const firstIncomingCompetition = payload.competitions[0] ?? competitions[0];
  const nextActiveCompetitionId =
    activeProjectMatches || !activeCompetitionStillExists
      ? firstIncomingCompetition?.id ?? current.activeCompetitionId
      : current.activeCompetitionId;
  const nextActiveParticipantId = participants.some(
    (participant) => participant.id === current.activeParticipantId
  )
    ? current.activeParticipantId
    : participants[0]?.id ?? initialAppState.activeParticipantId;
  const nextSelectedRoleId = roles.some((role) => role.id === current.selectedRoleId)
    ? current.selectedRoleId
    : roles[0]?.id ?? initialAppState.selectedRoleId;

  return {
    ...current,
    activeProjectId: nextActiveProjectId,
    activeCompetitionId: nextActiveCompetitionId,
    activeParticipantId: nextActiveParticipantId,
    selectedRoleId: nextSelectedRoleId,
    projects,
    competitions,
    participants,
    folders,
    roles,
    markers,
    integratedParticipantIdsByCompetition
  };
}

export function isProjectSyncPayload(value: unknown): value is ProjectSyncPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ProjectSyncPayload>;
  return (
    candidate.version === PROJECT_SYNC_VERSION &&
    Boolean(candidate.project?.id && candidate.project.shareId) &&
    Array.isArray(candidate.competitions) &&
    Array.isArray(candidate.participants) &&
    Array.isArray(candidate.folders) &&
    Array.isArray(candidate.roles) &&
    Array.isArray(candidate.markers) &&
    Boolean(candidate.integratedParticipantIdsByCompetition) &&
    typeof candidate.updatedAt === "string"
  );
}

function normalizeShareId(shareId: string): string {
  return shareId.trim().toUpperCase();
}

function mergeEntityCollections<T>(
  baseItems: T[],
  localItems: T[],
  remoteItems: T[],
  getKey: (item: T) => string,
  mergeChangedItem?: (base: T, local: T, remote: T) => T
): T[] {
  const baseByKey = new Map(baseItems.map((item) => [getKey(item), item]));
  const localByKey = new Map(localItems.map((item) => [getKey(item), item]));
  const remoteByKey = new Map(remoteItems.map((item) => [getKey(item), item]));
  const orderedKeys = unique([
    ...remoteItems.map(getKey),
    ...localItems.map(getKey),
    ...baseItems.map(getKey)
  ]);

  return orderedKeys.flatMap((key) => {
    const baseItem = baseByKey.get(key);
    const localItem = localByKey.get(key);
    const remoteItem = remoteByKey.get(key);
    const localChanged = !valuesEqual(localItem, baseItem);

    if (!localChanged) {
      return remoteItem ? [remoteItem] : [];
    }

    if (baseItem && localItem && remoteItem && mergeChangedItem) {
      return [mergeChangedItem(baseItem, localItem, remoteItem)];
    }

    return localItem ? [localItem] : [];
  });
}

function mergeRecordFields<T extends object>(base: T, local: T, remote: T): T {
  const result = { ...remote } as T;

  for (const key of Object.keys(local) as Array<keyof T>) {
    if (!valuesEqual(local[key], base[key])) {
      result[key] = local[key];
    }
  }

  return result;
}

function mergeRecordValues<T>(
  base: Record<string, T>,
  local: Record<string, T>,
  remote: Record<string, T>
): Record<string, T> {
  const result: Record<string, T> = {};
  const keys = unique([...Object.keys(remote), ...Object.keys(local), ...Object.keys(base)]);

  for (const key of keys) {
    const localChanged = !valuesEqual(local[key], base[key]);
    const value = localChanged ? local[key] : remote[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

function getMarkerSlotKey(marker: Marker): string {
  return [marker.competitionId, marker.participantId, marker.phase, marker.roleId].join(":");
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return stableSerialize(left) === stableSerialize(right);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortObjectKeys(item)])
  );
}
