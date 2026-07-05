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
  return JSON.stringify({
    ...payload,
    updatedAt: ""
  });
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
  const roles = payload.roles.length ? payload.roles : current.roles;
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
