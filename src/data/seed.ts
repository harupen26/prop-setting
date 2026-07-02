import type { AppState, ApparatusRole, Marker, Participant, Project, RoleFolder } from "../types";

const now = new Date().toISOString();

export const projects: Project[] = [
  {
    id: "project-yokohama-robins",
    name: "YOKOHAMA ROBINS",
    shareId: "YR-2026",
    createdAt: now
  }
];

export const folders: RoleFolder[] = [
  { id: "folder-m1", name: "M1", order: 1, visible: true, collapsed: false },
  { id: "folder-m2", name: "M2", order: 2, visible: true, collapsed: false },
  { id: "folder-m3", name: "M3", order: 3, visible: true, collapsed: false }
];

export const roles: ApparatusRole[] = [
  { id: "role-m1", folderId: "folder-m1", name: "M1", color: "#4c1d95", order: 1, visible: true },
  { id: "role-rifle", folderId: "folder-m1", name: "ライフル", color: "#2563eb", order: 2, visible: true },
  { id: "role-m1-double", folderId: "folder-m1", name: "M1ダブル", color: "#a3a3a3", order: 3, visible: true },
  { id: "role-saber", folderId: "folder-m1", name: "セイバー", color: "#06b6d4", order: 4, visible: true },
  { id: "role-m1-last", folderId: "folder-m1", name: "M1ラスト", color: "#14b8a6", order: 5, visible: true },
  { id: "role-white-cloth", folderId: "folder-m2", name: "白布（ダンサー）", color: "#ec4899", order: 6, visible: true },
  { id: "role-m2-swing", folderId: "folder-m2", name: "M2スイング", color: "#a855f7", order: 7, visible: true },
  { id: "role-m3-rifle", folderId: "folder-m3", name: "M3ライフル（2本目）", color: "#111827", order: 8, visible: true },
  { id: "role-m3-flag", folderId: "folder-m3", name: "M3フラッグ", color: "#f59e0b", order: 9, visible: true },
  { id: "role-company", folderId: "folder-m3", name: "カンパニー", color: "#ef4444", order: 10, visible: true },
  { id: "role-m3-last-regular", folderId: "folder-m3", name: "M3ラスト（レギュラー）", color: "#22c55e", order: 11, visible: true },
  { id: "role-m3-last-double", folderId: "folder-m3", name: "M3ラスト（ダブル）", color: "#d9f99d", order: 12, visible: true }
];

export const participants: Participant[] = [
  "ゆう",
  "はるき",
  "さくら",
  "さえ",
  "かいせい",
  "あやか",
  "ももこ",
  "さり",
  "せりは",
  "ゆな",
  "みのり",
  "みおり",
  "はるか",
  "くるみ",
  "ゆめり",
  "ほのか",
  "なな",
  "ふうか",
  "れいみ",
  "クリス",
  "まな",
  "りこ",
  "あおい",
  "ひまり",
  "ことね",
  "すず",
  "りん",
  "めい",
  "かな",
  "あん"
].map((name, index) => ({
  id: `participant-${index + 1}`,
  order: index + 1,
  name: `${index + 1}. ${name}`,
  markerLabel: name,
  token: `token-${String(index + 1).padStart(2, "0")}-${name}`
}));

const seedMarkers: Marker[] = [
  {
    id: "marker-entry-1",
    competitionId: "competition-prefectural",
    participantId: "participant-1",
    roleId: "role-saber",
    phase: "entry",
    xSnap: 98,
    ySnap: 12,
    updatedAt: now
  },
  {
    id: "marker-entry-2",
    competitionId: "competition-prefectural",
    participantId: "participant-1",
    roleId: "role-white-cloth",
    phase: "entry",
    xSnap: 118,
    ySnap: 12,
    updatedAt: now
  },
  {
    id: "marker-entry-3",
    competitionId: "competition-prefectural",
    participantId: "participant-1",
    roleId: "role-m3-rifle",
    phase: "entry",
    xSnap: 136,
    ySnap: 12,
    updatedAt: now
  },
  {
    id: "marker-exit-1",
    competitionId: "competition-prefectural",
    participantId: "participant-1",
    roleId: "role-m1",
    phase: "exit",
    xSnap: 80,
    ySnap: 128,
    updatedAt: now
  },
  {
    id: "marker-exit-2",
    competitionId: "competition-prefectural",
    participantId: "participant-1",
    roleId: "role-m1-double",
    phase: "exit",
    xSnap: 64,
    ySnap: 8,
    updatedAt: now
  },
  {
    id: "marker-exit-3",
    competitionId: "competition-prefectural",
    participantId: "participant-1",
    roleId: "role-saber",
    phase: "exit",
    xSnap: 118,
    ySnap: 8,
    updatedAt: now
  }
];

export const initialAppState: AppState = {
  activeProjectId: "project-yokohama-robins",
  activeCompetitionId: "competition-prefectural",
  activeParticipantId: "participant-1",
  selectedRoleId: "role-m1",
  activePhase: "entry",
  viewMode: "participant",
  competitions: [
    {
      id: "competition-prefectural",
      projectId: "project-yokohama-robins",
      name: "県大会",
      createdAt: now
    }
  ],
  projects,
  participants,
  folders,
  roles,
  markers: seedMarkers,
  integratedParticipantIdsByCompetition: {
    "competition-prefectural": ["participant-1"]
  }
};
