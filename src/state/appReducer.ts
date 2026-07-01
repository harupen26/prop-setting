import type { AppState, ApparatusRole, Competition, Marker, RoleFolder, ViewMode } from "../types";
import { initialAppState } from "../data/seed";
import { clampMarkerLabel, deriveMarkerLabelFromName } from "../domain/labels";

export type AppAction =
  | { type: "hydrate"; state: AppState }
  | { type: "reset" }
  | { type: "setPhase"; phase: AppState["activePhase"] }
  | { type: "setViewMode"; viewMode: ViewMode }
  | { type: "setActiveParticipant"; participantId: string }
  | { type: "setSelectedRole"; roleId: string }
  | { type: "setActiveCompetition"; competitionId: string }
  | { type: "placeMarker"; marker: Marker }
  | { type: "moveMarker"; markerId: string; xSnap: number; ySnap: number }
  | { type: "deleteMarker"; markerId: string }
  | { type: "toggleRoleVisible"; roleId: string }
  | { type: "toggleFolderVisible"; folderId: string }
  | { type: "toggleFolderCollapsed"; folderId: string }
  | { type: "addFolder"; folder: RoleFolder }
  | { type: "addRole"; role: ApparatusRole }
  | { type: "updateParticipantName"; participantId: string; name: string }
  | { type: "updateParticipantLabel"; participantId: string; markerLabel: string }
  | { type: "integrateParticipant"; competitionId: string; participantId: string }
  | { type: "integrateAll"; competitionId: string }
  | { type: "duplicateCompetition"; competition: Competition };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "hydrate":
      return normalizeState(action.state);
    case "reset":
      return initialAppState;
    case "setPhase":
      return { ...state, activePhase: action.phase };
    case "setViewMode":
      return { ...state, viewMode: action.viewMode };
    case "setActiveParticipant":
      return { ...state, activeParticipantId: action.participantId, viewMode: "participant" };
    case "setSelectedRole":
      return { ...state, selectedRoleId: action.roleId };
    case "setActiveCompetition":
      return { ...state, activeCompetitionId: action.competitionId };
    case "placeMarker":
      return { ...state, markers: [...state.markers, action.marker] };
    case "moveMarker":
      return {
        ...state,
        markers: state.markers.map((marker) =>
          marker.id === action.markerId
            ? { ...marker, xSnap: action.xSnap, ySnap: action.ySnap, updatedAt: new Date().toISOString() }
            : marker
        )
      };
    case "deleteMarker":
      return { ...state, markers: state.markers.filter((marker) => marker.id !== action.markerId) };
    case "toggleRoleVisible":
      return {
        ...state,
        roles: state.roles.map((role) =>
          role.id === action.roleId ? { ...role, visible: !role.visible } : role
        )
      };
    case "toggleFolderVisible":
      return {
        ...state,
        folders: state.folders.map((folder) =>
          folder.id === action.folderId ? { ...folder, visible: !folder.visible } : folder
        )
      };
    case "toggleFolderCollapsed":
      return {
        ...state,
        folders: state.folders.map((folder) =>
          folder.id === action.folderId ? { ...folder, collapsed: !folder.collapsed } : folder
        )
      };
    case "addFolder":
      return { ...state, folders: [...state.folders, action.folder] };
    case "addRole":
      return { ...state, roles: [...state.roles, action.role], selectedRoleId: action.role.id };
    case "updateParticipantName":
      return {
        ...state,
        participants: state.participants.map((participant) =>
          participant.id === action.participantId
            ? {
                ...participant,
                name: action.name,
                markerLabel: deriveMarkerLabelFromName(action.name)
              }
            : participant
        )
      };
    case "updateParticipantLabel":
      return {
        ...state,
        participants: state.participants.map((participant) =>
          participant.id === action.participantId
            ? { ...participant, markerLabel: clampMarkerLabel(action.markerLabel) }
            : participant
        )
      };
    case "integrateParticipant": {
      const current = state.integratedParticipantIdsByCompetition[action.competitionId] ?? [];
      const next = current.includes(action.participantId) ? current : [...current, action.participantId];

      return {
        ...state,
        integratedParticipantIdsByCompetition: {
          ...state.integratedParticipantIdsByCompetition,
          [action.competitionId]: next
        }
      };
    }
    case "integrateAll":
      return {
        ...state,
        integratedParticipantIdsByCompetition: {
          ...state.integratedParticipantIdsByCompetition,
          [action.competitionId]: state.participants.map((participant) => participant.id)
        },
        viewMode: "master"
      };
    case "duplicateCompetition": {
      const copiedMarkers = state.markers
        .filter((marker) => marker.competitionId === state.activeCompetitionId)
        .map((marker) => ({
          ...marker,
          id: `${marker.id}-${action.competition.id}`,
          competitionId: action.competition.id,
          updatedAt: new Date().toISOString()
        }));

      return {
        ...state,
        competitions: [...state.competitions, action.competition],
        activeCompetitionId: action.competition.id,
        markers: [...state.markers, ...copiedMarkers],
        integratedParticipantIdsByCompetition: {
          ...state.integratedParticipantIdsByCompetition,
          [action.competition.id]: state.integratedParticipantIdsByCompetition[state.activeCompetitionId] ?? []
        }
      };
    }
    default:
      return state;
  }
}

function normalizeState(state: AppState): AppState {
  return {
    ...initialAppState,
    ...state,
    competitions: state.competitions?.length ? state.competitions : initialAppState.competitions,
    participants: state.participants?.length ? state.participants : initialAppState.participants,
    folders: state.folders?.length ? state.folders : initialAppState.folders,
    roles: state.roles?.length ? state.roles : initialAppState.roles,
    markers: state.markers ?? [],
    integratedParticipantIdsByCompetition: state.integratedParticipantIdsByCompetition ?? {}
  };
}
