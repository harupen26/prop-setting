import { describe, expect, it } from "vitest";

import { buildOverlapMap, coordinateToSnap, getOverlapOffset } from "./grid";
import { deriveMarkerLabelFromName, formatMarkerLabel } from "./labels";
import { replaceParticipantMarkers } from "./merge";
import { initialAppState } from "../data/seed";
import { getVisibleMarkers } from "../selectors";
import { appReducer } from "../state/appReducer";
import {
  buildProjectSyncPayload,
  mergeConcurrentProjectSyncPayload,
  mergeProjectSyncPayload
} from "../state/projectSync";
import type { Competition, Marker, Project } from "../types";
import { getGuideSteps, helpSections } from "../guide/guideContent";

describe("座標吸着", () => {
  it("キャンバス座標を0.3125m単位のスナップ座標へ変換する", () => {
    expect(coordinateToSnap(250, 200, { width: 500, height: 400 })).toEqual({
      xSnap: 80,
      ySnap: 64
    });
  });

  it("範囲外のタップは端に丸める", () => {
    expect(coordinateToSnap(999, -100, { width: 500, height: 400 })).toEqual({
      xSnap: 160,
      ySnap: 0
    });
  });
});

describe("丸内ラベル", () => {
  it("3文字までは1行で表示する", () => {
    expect(formatMarkerLabel("はる")).toEqual(["はる"]);
    expect(formatMarkerLabel("さくら")).toEqual(["さくら"]);
  });

  it("4文字は2文字ずつ改行する", () => {
    expect(formatMarkerLabel("かいせい")).toEqual(["かい", "せい"]);
  });

  it("5文字以上は4文字までにする", () => {
    expect(formatMarkerLabel("ありがとう")).toEqual(["あり", "がと"]);
  });

  it("ユーザー名から番号を除いて丸内ラベルを作る", () => {
    expect(deriveMarkerLabelFromName("1. ゆう")).toBe("ゆう");
    expect(deriveMarkerLabelFromName("①ゆう")).toBe("ゆう");
    expect(deriveMarkerLabelFromName("20. クリス")).toBe("クリス");
  });
});

describe("重なり表示", () => {
  it("2つ目以降を中心から外向きにずらす", () => {
    const step = { x: 5, y: 7 };

    expect(getOverlapOffset({ xSnap: 80, ySnap: 20 }, { index: 1, count: 2 }, step)).toEqual({
      dx: 0,
      dy: -7
    });
    expect(getOverlapOffset({ xSnap: 80, ySnap: 100 }, { index: 2, count: 3 }, step)).toEqual({
      dx: 0,
      dy: 14
    });
    expect(getOverlapOffset({ xSnap: 20, ySnap: 64 }, { index: 1, count: 2 }, step)).toEqual({
      dx: -5,
      dy: 0
    });
    expect(getOverlapOffset({ xSnap: 140, ySnap: 64 }, { index: 1, count: 2 }, step)).toEqual({
      dx: 5,
      dy: 0
    });
  });

  it("手具フォルダの上から順に正規位置に残す", () => {
    const laterMarker = { ...marker("later-marker", "participant-a", 40), roleId: "role-late" };
    const earlyMarker = { ...marker("early-marker", "participant-b", 40), roleId: "role-early" };

    const overlap = buildOverlapMap([laterMarker, earlyMarker], {
      folders: [{ id: "folder-m1", name: "M1", order: 1, visible: true, collapsed: false }],
      roles: [
        {
          id: "role-late",
          folderId: "folder-m1",
          name: "Late",
          color: "#0f172a",
          order: 2,
          visible: true
        },
        {
          id: "role-early",
          folderId: "folder-m1",
          name: "Early",
          color: "#0f766e",
          order: 1,
          visible: true
        }
      ]
    });

    expect(overlap["early-marker"].index).toBe(0);
    expect(overlap["later-marker"].index).toBe(1);
  });
});

describe("使い方ガイド", () => {
  it("メンバー向けと管理者向けのチュートリアルを定義している", () => {
    expect(getGuideSteps("member").length).toBeGreaterThan(0);
    expect(getGuideSteps("admin").length).toBeGreaterThan(0);
  });

  it("各ステップは表示に必要な本文と画面を持つ", () => {
    const steps = [...getGuideSteps("member"), ...getGuideSteps("admin")];

    for (const step of steps) {
      expect(step.title.trim()).not.toBe("");
      expect(step.body.trim()).not.toBe("");
      expect(step.screen).toBeTruthy();
    }
  });

  it("ヘルプ画面のセクションを用意している", () => {
    expect(helpSections.length).toBeGreaterThan(0);
    expect(helpSections.every((section) => section.body.length > 0)).toBe(true);
  });

  it("実際に押して進めるステップを含む", () => {
    const steps = [...getGuideSteps("member"), ...getGuideSteps("admin")];

    expect(steps.some((step) => step.advanceOnTargetPress)).toBe(true);
  });
});

describe("統合", () => {
  it("同じ参加者を再統合しても重複せず置き換える", () => {
    const master: Marker[] = [
      marker("old-a", "participant-a", 10),
      marker("keep-b", "participant-b", 20)
    ];
    const draft: Marker[] = [marker("new-a", "participant-a", 30)];

    const result = replaceParticipantMarkers(master, draft, "participant-a", "competition-1");

    expect(result.map((item) => item.id).sort()).toEqual(["keep-b", "new-a"]);
  });

  it("統合表示では統合済みIDに関係なく全参加者の丸を表示する", () => {
    const state = {
      ...initialAppState,
      activeCompetitionId: "competition-1",
      viewMode: "master" as const,
      markers: [
        marker("marker-a", "participant-1", 10),
        marker("marker-b", "participant-2", 20)
      ],
      integratedParticipantIdsByCompetition: {
        "competition-1": ["participant-1"]
      }
    };

    expect(getVisibleMarkers(state).map((item) => item.id).sort()).toEqual([
      "marker-a",
      "marker-b"
    ]);
  });

  it("同じシートに同じ手具を再配置したら既存の丸を置き換える", () => {
    const oldMarker = marker("old-marker", "participant-1", 10);
    const otherPhaseMarker = { ...marker("other-phase", "participant-1", 20), phase: "exit" as const };
    const nextMarker = marker("next-marker", "participant-1", 30);
    const state = {
      ...initialAppState,
      markers: [oldMarker, otherPhaseMarker]
    };

    const result = appReducer(state, { type: "placeMarker", marker: nextMarker });

    expect(result.markers.map((item) => item.id).sort()).toEqual([
      "next-marker",
      "other-phase"
    ]);
  });

  it("選択した手具を削除すると関連する丸も削除し次の手具を選ぶ", () => {
    const state = {
      ...initialAppState,
      selectedRoleId: "role-m1",
      markers: [
        { ...marker("delete-marker", "participant-1", 10), roleId: "role-m1" },
        { ...marker("keep-marker", "participant-1", 20), roleId: "role-rifle" }
      ]
    };

    const result = appReducer(state, { type: "deleteRoles", roleIds: ["role-m1"] });

    expect(result.roles.some((role) => role.id === "role-m1")).toBe(false);
    expect(result.markers.map((item) => item.id)).toEqual(["keep-marker"]);
    expect(result.selectedRoleId).toBe("role-rifle");
  });

  it("すべての手具を削除しても空の手具一覧を保持する", () => {
    const result = appReducer(initialAppState, {
      type: "deleteRoles",
      roleIds: initialAppState.roles.map((role) => role.id)
    });

    expect(result.roles).toEqual([]);
    expect(result.markers).toEqual([]);
    expect(result.selectedRoleId).toBe("");

    const hydrated = appReducer(initialAppState, { type: "hydrate", state: result });
    expect(hydrated.roles).toEqual([]);
  });

  it("参加者を追加すると編集中の参加者として選ばれ丸内ラベルも作られる", () => {
    const result = appReducer(initialAppState, { type: "addParticipant", name: "31. かな" });
    const added = result.participants[result.participants.length - 1];

    expect(added.name).toBe("31. かな");
    expect(added.markerLabel).toBe("かな");
    expect(result.activeParticipantId).toBe(added.id);
    expect(result.viewMode).toBe("participant");
  });

  it("参加者を削除すると丸と統合設定も削除し次の参加者を選ぶ", () => {
    const state = {
      ...initialAppState,
      activeParticipantId: "participant-1",
      markers: [
        marker("delete-marker", "participant-1", 10),
        marker("keep-marker", "participant-2", 20)
      ],
      integratedParticipantIdsByCompetition: {
        "competition-1": ["participant-1", "participant-2"]
      }
    };

    const result = appReducer(state, { type: "deleteParticipant", participantId: "participant-1" });

    expect(result.activeParticipantId).toBe("participant-2");
    expect(result.participants.some((participant) => participant.id === "participant-1")).toBe(false);
    expect(result.markers.map((item) => item.id)).toEqual(["keep-marker"]);
    expect(result.integratedParticipantIdsByCompetition["competition-1"]).toEqual(["participant-2"]);
  });

  it("最後の参加者は削除しない", () => {
    const state = {
      ...initialAppState,
      participants: [initialAppState.participants[0]],
      activeParticipantId: "participant-1",
      markers: [marker("keep-marker", "participant-1", 10)]
    };

    const result = appReducer(state, { type: "deleteParticipant", participantId: "participant-1" });

    expect(result.participants).toHaveLength(1);
    expect(result.activeParticipantId).toBe("participant-1");
    expect(result.markers).toHaveLength(1);
  });

  it("シートコピーは同じプロジェクトの新しいバージョンとして追加される", () => {
    const result = appReducer(initialAppState, {
      type: "duplicateCompetition",
      competition: {
        id: "competition-kanto",
        projectId: initialAppState.activeProjectId,
        name: "関東大会",
        createdAt: "2026-07-03T00:00:00.000Z",
        copiedFromCompetitionId: initialAppState.activeCompetitionId
      }
    });

    expect(result.activeCompetitionId).toBe("competition-kanto");
    expect(result.activeProjectId).toBe(initialAppState.activeProjectId);
    expect(result.competitions.find((competition) => competition.id === "competition-kanto")?.name).toBe("関東大会");
    expect(result.markers.some((marker) => marker.competitionId === "competition-kanto")).toBe(true);
  });

  it("更新版シートを削除すると丸と統合設定も消える", () => {
    const duplicated = appReducer(initialAppState, {
      type: "duplicateCompetition",
      competition: competition("competition-kanto", initialAppState.activeProjectId, "関東大会", {
        copiedFromCompetitionId: initialAppState.activeCompetitionId
      })
    });

    const result = appReducer(duplicated, { type: "deleteCompetition", competitionId: "competition-kanto" });

    expect(result.activeCompetitionId).toBe(initialAppState.activeCompetitionId);
    expect(result.competitions.some((item) => item.id === "competition-kanto")).toBe(false);
    expect(result.markers.some((item) => item.competitionId === "competition-kanto")).toBe(false);
    expect(result.integratedParticipantIdsByCompetition["competition-kanto"]).toBeUndefined();
  });

  it("元シートは削除しない", () => {
    const result = appReducer(initialAppState, {
      type: "deleteCompetition",
      competitionId: initialAppState.activeCompetitionId
    });

    expect(result.competitions.some((competition) => competition.id === initialAppState.activeCompetitionId)).toBe(true);
  });

  it("プロジェクトを作成すると最初のシートも作成して開く", () => {
    const result = appReducer(initialAppState, {
      type: "createProject",
      project: project("project-new", "新規プロジェクト", "NEW-2026"),
      competition: competition("competition-new", "project-new", "県大会")
    });

    expect(result.activeProjectId).toBe("project-new");
    expect(result.activeCompetitionId).toBe("competition-new");
    expect(result.projects.some((item) => item.shareId === "NEW-2026")).toBe(true);
    expect(result.competitions.some((item) => item.projectId === "project-new")).toBe(true);
  });

  it("招待IDで参加すると自分のプロジェクト一覧に追加して開く", () => {
    const result = appReducer(initialAppState, {
      type: "joinProject",
      project: project("project-joined", "参加プロジェクト ABC-123", "ABC-123"),
      competition: competition("competition-joined", "project-joined", "共有シート")
    });

    expect(result.activeProjectId).toBe("project-joined");
    expect(result.activeCompetitionId).toBe("competition-joined");
    expect(result.projects.find((item) => item.id === "project-joined")?.shareId).toBe("ABC-123");
  });

  it("同じ招待IDで参加した場合は既存プロジェクトを開く", () => {
    const result = appReducer(initialAppState, {
      type: "joinProject",
      project: project("project-duplicate", "重複プロジェクト", initialAppState.projects[0].shareId),
      competition: competition("competition-duplicate", "project-duplicate", "共有シート")
    });

    expect(result.activeProjectId).toBe(initialAppState.activeProjectId);
    expect(result.projects.some((item) => item.id === "project-duplicate")).toBe(false);
  });
});

describe("DB同期", () => {
  it("同じ招待IDの仮プロジェクトをDB側のプロジェクトに置き換える", () => {
    const local = appReducer(initialAppState, {
      type: "joinProject",
      project: project("project-local", "参加中", "SYNC2026"),
      competition: competition("competition-local", "project-local", "ローカル")
    });
    const remoteProject = project("project-remote", "共有プロジェクト", "SYNC2026");
    const remoteCompetition = competition("competition-remote", "project-remote", "共有シート");
    const remoteMarker: Marker = {
      ...marker("remote-marker", "participant-1", 42),
      competitionId: remoteCompetition.id
    };
    const remoteState = {
      ...initialAppState,
      activeProjectId: remoteProject.id,
      activeCompetitionId: remoteCompetition.id,
      projects: [remoteProject],
      competitions: [remoteCompetition],
      markers: [remoteMarker],
      integratedParticipantIdsByCompetition: {
        [remoteCompetition.id]: ["participant-1"]
      }
    };
    const payload = buildProjectSyncPayload(remoteState);

    expect(payload).toBeTruthy();
    const merged = mergeProjectSyncPayload(local, payload!);

    expect(merged.activeProjectId).toBe(remoteProject.id);
    expect(merged.projects.some((item) => item.id === "project-local")).toBe(false);
    expect(merged.projects.some((item) => item.id === remoteProject.id)).toBe(true);
    expect(merged.competitions.some((item) => item.id === "competition-local")).toBe(false);
    expect(merged.markers.some((item) => item.competitionId === "competition-local")).toBe(false);
    expect(merged.markers.some((item) => item.id === remoteMarker.id)).toBe(true);
  });

  it("別々の参加者が同時に丸を動かしても両方の変更を残す", () => {
    const baseState = {
      ...initialAppState,
      markers: [
        { ...marker("marker-a", "participant-1", 10), competitionId: initialAppState.activeCompetitionId },
        { ...marker("marker-b", "participant-2", 20), competitionId: initialAppState.activeCompetitionId }
      ]
    };
    const localState = appReducer(baseState, {
      type: "moveMarker",
      markerId: "marker-a",
      xSnap: 30,
      ySnap: 10
    });
    const remoteState = appReducer(baseState, {
      type: "moveMarker",
      markerId: "marker-b",
      xSnap: 40,
      ySnap: 10
    });
    const base = buildProjectSyncPayload(baseState)!;
    const local = buildProjectSyncPayload(localState)!;
    const remote = buildProjectSyncPayload(remoteState)!;

    const merged = mergeConcurrentProjectSyncPayload(base, local, remote);

    expect(merged.markers.find((item) => item.id === "marker-a")?.xSnap).toBe(30);
    expect(merged.markers.find((item) => item.id === "marker-b")?.xSnap).toBe(40);
  });

  it("30人がそれぞれ自分の丸を同時編集しても全員分を統合する", () => {
    const baseState = {
      ...initialAppState,
      markers: initialAppState.participants.map((participant, index) => ({
        ...marker(`marker-${index + 1}`, participant.id, index),
        competitionId: initialAppState.activeCompetitionId
      }))
    };
    const base = buildProjectSyncPayload(baseState)!;
    let server = base;

    for (let index = 0; index < initialAppState.participants.length; index += 1) {
      const localState = appReducer(baseState, {
        type: "moveMarker",
        markerId: `marker-${index + 1}`,
        xSnap: index + 50,
        ySnap: 10
      });
      server = mergeConcurrentProjectSyncPayload(
        base,
        buildProjectSyncPayload(localState)!,
        server
      );
    }

    expect(server.markers).toHaveLength(initialAppState.participants.length);
    expect(server.markers.every((item) => item.xSnap >= 50)).toBe(true);
  });

  it("参加者名と別の丸を同時編集しても両方の変更を残す", () => {
    const baseState = {
      ...initialAppState,
      markers: [
        { ...marker("marker-a", "participant-1", 10), competitionId: initialAppState.activeCompetitionId }
      ]
    };
    const localState = appReducer(baseState, {
      type: "updateParticipantName",
      participantId: "participant-1",
      name: "1. 新しい名前"
    });
    const remoteState = appReducer(baseState, {
      type: "moveMarker",
      markerId: "marker-a",
      xSnap: 45,
      ySnap: 10
    });

    const merged = mergeConcurrentProjectSyncPayload(
      buildProjectSyncPayload(baseState)!,
      buildProjectSyncPayload(localState)!,
      buildProjectSyncPayload(remoteState)!
    );

    expect(merged.participants.find((item) => item.id === "participant-1")?.name).toBe(
      "1. 新しい名前"
    );
    expect(merged.markers.find((item) => item.id === "marker-a")?.xSnap).toBe(45);
  });

  it("同じ手具枠を同時に動かした場合は保存を再試行した側を採用する", () => {
    const baseState = {
      ...initialAppState,
      markers: [
        { ...marker("marker-a", "participant-1", 10), competitionId: initialAppState.activeCompetitionId }
      ]
    };
    const localState = appReducer(baseState, {
      type: "moveMarker",
      markerId: "marker-a",
      xSnap: 30,
      ySnap: 10
    });
    const remoteState = appReducer(baseState, {
      type: "moveMarker",
      markerId: "marker-a",
      xSnap: 50,
      ySnap: 10
    });

    const merged = mergeConcurrentProjectSyncPayload(
      buildProjectSyncPayload(baseState)!,
      buildProjectSyncPayload(localState)!,
      buildProjectSyncPayload(remoteState)!
    );

    expect(merged.markers).toHaveLength(1);
    expect(merged.markers[0].xSnap).toBe(30);
  });

  it("同じ手具枠へ別IDの丸を同時配置しても重複させない", () => {
    const baseState = {
      ...initialAppState,
      markers: [
        { ...marker("old-marker", "participant-1", 10), competitionId: initialAppState.activeCompetitionId }
      ]
    };
    const localState = appReducer(baseState, {
      type: "placeMarker",
      marker: {
        ...marker("local-marker", "participant-1", 30),
        competitionId: initialAppState.activeCompetitionId
      }
    });
    const remoteState = appReducer(baseState, {
      type: "placeMarker",
      marker: {
        ...marker("remote-marker", "participant-1", 50),
        competitionId: initialAppState.activeCompetitionId
      }
    });

    const merged = mergeConcurrentProjectSyncPayload(
      buildProjectSyncPayload(baseState)!,
      buildProjectSyncPayload(localState)!,
      buildProjectSyncPayload(remoteState)!
    );

    expect(merged.markers).toHaveLength(1);
    expect(merged.markers[0].id).toBe("local-marker");
    expect(merged.markers[0].xSnap).toBe(30);
  });

  it("手具を削除した端末と別の手具を編集した端末の変更を統合する", () => {
    const baseState = {
      ...initialAppState,
      markers: [
        {
          ...marker("delete-marker", "participant-1", 10),
          competitionId: initialAppState.activeCompetitionId,
          roleId: "role-m1"
        },
        {
          ...marker("keep-marker", "participant-2", 20),
          competitionId: initialAppState.activeCompetitionId,
          roleId: "role-rifle"
        }
      ]
    };
    const localState = appReducer(baseState, { type: "deleteRoles", roleIds: ["role-m1"] });
    const remoteState = appReducer(baseState, {
      type: "moveMarker",
      markerId: "keep-marker",
      xSnap: 60,
      ySnap: 10
    });

    const merged = mergeConcurrentProjectSyncPayload(
      buildProjectSyncPayload(baseState)!,
      buildProjectSyncPayload(localState)!,
      buildProjectSyncPayload(remoteState)!
    );

    expect(merged.roles.some((role) => role.id === "role-m1")).toBe(false);
    expect(merged.markers.some((item) => item.id === "delete-marker")).toBe(false);
    expect(merged.markers.find((item) => item.id === "keep-marker")?.xSnap).toBe(60);
  });
});

function marker(id: string, participantId: string, xSnap: number): Marker {
  return {
    id,
    competitionId: "competition-1",
    participantId,
    roleId: "role-m1",
    phase: "entry",
    xSnap,
    ySnap: 10,
    updatedAt: "2026-06-30T00:00:00.000Z"
  };
}

function project(id: string, name: string, shareId: string): Project {
  return {
    id,
    name,
    shareId,
    createdAt: "2026-07-03T00:00:00.000Z"
  };
}

function competition(
  id: string,
  projectId: string,
  name: string,
  overrides: Partial<Competition> = {}
): Competition {
  return {
    id,
    projectId,
    name,
    createdAt: "2026-07-03T00:00:00.000Z",
    ...overrides
  };
}
