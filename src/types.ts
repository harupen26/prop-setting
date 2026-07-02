export type Phase = "entry" | "exit";

export type ViewMode = "participant" | "master";

export type Project = {
  id: string;
  name: string;
  shareId: string;
  createdAt: string;
};

export type Competition = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  copiedFromCompetitionId?: string;
};

export type Participant = {
  id: string;
  order: number;
  name: string;
  markerLabel: string;
  token: string;
};

export type RoleFolder = {
  id: string;
  name: string;
  order: number;
  visible: boolean;
  collapsed: boolean;
};

export type ApparatusRole = {
  id: string;
  folderId: string;
  name: string;
  color: string;
  order: number;
  visible: boolean;
};

export type Marker = {
  id: string;
  competitionId: string;
  participantId: string;
  roleId: string;
  phase: Phase;
  xSnap: number;
  ySnap: number;
  note?: string;
  updatedAt: string;
};

export type AppState = {
  activeProjectId: string;
  activeCompetitionId: string;
  activeParticipantId: string;
  selectedRoleId: string;
  activePhase: Phase;
  viewMode: ViewMode;
  projects: Project[];
  competitions: Competition[];
  participants: Participant[];
  folders: RoleFolder[];
  roles: ApparatusRole[];
  markers: Marker[];
  integratedParticipantIdsByCompetition: Record<string, string[]>;
};
