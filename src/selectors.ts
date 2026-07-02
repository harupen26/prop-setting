import type { AppState, ApparatusRole, Marker, Participant, Project, RoleFolder } from "./types";

export function getActiveCompetition(state: AppState) {
  return state.competitions.find((competition) => competition.id === state.activeCompetitionId);
}

export function getActiveProject(state: AppState): Project | undefined {
  return state.projects.find((project) => project.id === state.activeProjectId);
}

export function getProjectCompetitions(state: AppState) {
  return state.competitions.filter((competition) => competition.projectId === state.activeProjectId);
}

export function getActiveParticipant(state: AppState): Participant {
  return (
    state.participants.find((participant) => participant.id === state.activeParticipantId) ??
    state.participants[0]
  );
}

export function getSelectedRole(state: AppState): ApparatusRole {
  return state.roles.find((role) => role.id === state.selectedRoleId) ?? state.roles[0];
}

export function getFolderById(state: AppState, folderId: string): RoleFolder | undefined {
  return state.folders.find((folder) => folder.id === folderId);
}

export function isRoleVisible(state: AppState, roleId: string): boolean {
  const role = state.roles.find((item) => item.id === roleId);
  if (!role || !role.visible) {
    return false;
  }

  const folder = getFolderById(state, role.folderId);
  return folder?.visible ?? true;
}

export function getVisibleMarkers(state: AppState): Marker[] {
  const participantIds =
    state.viewMode === "master"
      ? state.participants.map((participant) => participant.id)
      : [state.activeParticipantId];

  return state.markers.filter(
    (marker) =>
      marker.competitionId === state.activeCompetitionId &&
      marker.phase === state.activePhase &&
      participantIds.includes(marker.participantId) &&
      isRoleVisible(state, marker.roleId)
  );
}

export function getParticipantById(state: AppState, participantId: string): Participant | undefined {
  return state.participants.find((participant) => participant.id === participantId);
}

export function getRoleById(state: AppState, roleId: string): ApparatusRole | undefined {
  return state.roles.find((role) => role.id === roleId);
}
