import type { AppState, ApparatusRole, Competition, Marker, Project, RoleFolder, ViewMode } from "../types";
import { initialAppState } from "../data/seed";
import { clampMarkerLabel, deriveMarkerLabelFromName } from "../domain/labels";

export type AppAction =
  | { type: "hydrate"; state: AppState }
  | { type: "reset" }
  | { type: "setPhase"; phase: AppState["activePhase"] }
  | { type: "setViewMode"; viewMode: ViewMode }
  | { type: "setActiveParticipant"; participantId: string }
  | { type: "setSelectedRole"; roleId: string }
  | { type: "setActiveProject"; projectId: string }
  | { type: "setActiveCompetition"; competitionId: string }
  | { type: "placeMarker"; marker: Marker }
  | { type: "moveMarker"; markerId: string; xSnap: number; ySnap: number }
  | { type: "deleteMarker"; markerId: string }
  | { type: "toggleRoleVisible"; roleId: string }
  | { type: "toggleFolderVisible"; folderId: string }
  | { type: "toggleFolderCollapsed"; folderId: string }
  | { type: "addFolder"; folder: RoleFolder }
  | { type: "addRole"; role: ApparatusRole }
  | { type: "addParticipant"; name: string }
  | { type: "updateParticipantName"; participantId: string; name: string }
  | { type: "updateParticipantLabel"; participantId: string; markerLabel: string }
  | { type: "updateProjectName"; projectId: string; name: string }
  | { type: "updateCompetitionName"; competitionId: string; name: string }
  | { type: "integrateParticipant"; competitionId: string; participantId: string }
  | { type: "integrateAll"; competitionId: string }
  | { type: "duplicateCompetition"; competition: Competition }
  | { type: "deleteCompetition"; competitionId: string }
  | { type: "createProject"; project: Project; competition: Competition }
  | { type: "joinProject"; project: Project; competition: Competition };

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
    case "setActiveProject": {
      const nextCompetition =
        state.competitions.find((competition) => competition.projectId === action.projectId) ??
        state.competitions[0];

      return {
        ...state,
        activeProjectId: action.projectId,
        activeCompetitionId: nextCompetition?.id ?? state.activeCompetitionId
      };
    }
    case "setActiveCompetition":
      return {
        ...state,
        activeCompetitionId: action.competitionId,
        activeProjectId:
          state.competitions.find((competition) => competition.id === action.competitionId)?.projectId ??
          state.activeProjectId
      };
    case "placeMarker":
      return {
        ...state,
        markers: [
          ...state.markers.filter(
            (marker) =>
              marker.competitionId !== action.marker.competitionId ||
              marker.participantId !== action.marker.participantId ||
              marker.phase !== action.marker.phase ||
              marker.roleId !== action.marker.roleId
          ),
          action.marker
        ]
      };
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
    case "addParticipant": {
      const name = action.name.trim();
      if (!name) {
        return state;
      }

      const id = `participant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const order = Math.max(0, ...state.participants.map((participant) => participant.order)) + 1;

      return {
        ...state,
        activeParticipantId: id,
        viewMode: "participant",
        participants: [
          ...state.participants,
          {
            id,
            order,
            name,
            markerLabel: deriveMarkerLabelFromName(name),
            token: createParticipantToken(id, name)
          }
        ]
      };
    }
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
    case "updateProjectName":
      return {
        ...state,
        projects: state.projects.map((project) =>
          project.id === action.projectId ? { ...project, name: action.name } : project
        )
      };
    case "updateCompetitionName":
      return {
        ...state,
        competitions: state.competitions.map((competition) =>
          competition.id === action.competitionId ? { ...competition, name: action.name } : competition
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
        activeProjectId: action.competition.projectId,
        activeCompetitionId: action.competition.id,
        markers: [...state.markers, ...copiedMarkers],
        integratedParticipantIdsByCompetition: {
          ...state.integratedParticipantIdsByCompetition,
          [action.competition.id]: state.integratedParticipantIdsByCompetition[state.activeCompetitionId] ?? []
        }
      };
    }
    case "deleteCompetition": {
      const target = state.competitions.find((competition) => competition.id === action.competitionId);
      if (!target?.copiedFromCompetitionId) {
        return state;
      }

      const projectCompetitions = state.competitions.filter(
        (competition) => competition.projectId === target.projectId
      );
      if (projectCompetitions.length <= 1) {
        return state;
      }

      const competitions = state.competitions.filter((competition) => competition.id !== target.id);
      const nextCompetition =
        state.activeCompetitionId === target.id
          ? competitions.find((competition) => competition.projectId === target.projectId) ?? competitions[0]
          : state.competitions.find((competition) => competition.id === state.activeCompetitionId);
      const { [target.id]: _deletedIntegratedIds, ...integratedParticipantIdsByCompetition } =
        state.integratedParticipantIdsByCompetition;

      return {
        ...state,
        activeCompetitionId: nextCompetition?.id ?? state.activeCompetitionId,
        activeProjectId: nextCompetition?.projectId ?? state.activeProjectId,
        competitions,
        markers: state.markers.filter((marker) => marker.competitionId !== target.id),
        integratedParticipantIdsByCompetition
      };
    }
    case "createProject":
    case "joinProject":
      return addProject(state, action.project, action.competition);
    default:
      return state;
  }
}

function addProject(state: AppState, project: Project, competition: Competition): AppState {
  const shareIdTaken = state.projects.some(
    (item) => item.shareId.toLowerCase() === project.shareId.toLowerCase()
  );
  if (shareIdTaken) {
    const existingProject = state.projects.find(
      (item) => item.shareId.toLowerCase() === project.shareId.toLowerCase()
    );
    const existingCompetition =
      state.competitions.find((item) => item.projectId === existingProject?.id) ?? state.competitions[0];

    return {
      ...state,
      activeProjectId: existingProject?.id ?? state.activeProjectId,
      activeCompetitionId: existingCompetition?.id ?? state.activeCompetitionId
    };
  }

  return {
    ...state,
    activeProjectId: project.id,
    activeCompetitionId: competition.id,
    viewMode: "participant",
    projects: [...state.projects, project],
    competitions: [...state.competitions, competition],
    integratedParticipantIdsByCompetition: {
      ...state.integratedParticipantIdsByCompetition,
      [competition.id]: [state.activeParticipantId]
    }
  };
}

function normalizeState(state: AppState): AppState {
  const projects = normalizeProjects(state);
  const activeProjectId = state.activeProjectId ?? projects[0]?.id ?? initialAppState.activeProjectId;
  const competitions = normalizeCompetitions(state, activeProjectId);

  return {
    ...initialAppState,
    ...state,
    activeProjectId,
    projects,
    competitions,
    participants: state.participants?.length ? state.participants : initialAppState.participants,
    folders: state.folders?.length ? state.folders : initialAppState.folders,
    roles: state.roles?.length ? state.roles : initialAppState.roles,
    markers: state.markers ?? [],
    integratedParticipantIdsByCompetition: state.integratedParticipantIdsByCompetition ?? {}
  };
}

function normalizeProjects(state: AppState): Project[] {
  if (state.projects?.length) {
    return state.projects.map((project) => ({
      ...project,
      shareId: project.shareId || createProjectShareId(project.id)
    }));
  }

  return initialAppState.projects;
}

function normalizeCompetitions(state: AppState, fallbackProjectId: string): Competition[] {
  const source = state.competitions?.length ? state.competitions : initialAppState.competitions;

  return source.map((competition) => ({
    ...competition,
    projectId: competition.projectId ?? fallbackProjectId
  }));
}

function createProjectShareId(id: string): string {
  return `local-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "project"}`;
}

function createParticipantToken(id: string, name: string): string {
  return `${id}-${name}`.replace(/\s+/g, "-");
}
