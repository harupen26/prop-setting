import { describe, expect, it } from "vitest";

import { coordinateToSnap, getOverlapOffset } from "./grid";
import { deriveMarkerLabelFromName, formatMarkerLabel } from "./labels";
import { replaceParticipantMarkers } from "./merge";
import { initialAppState } from "../data/seed";
import { getVisibleMarkers } from "../selectors";
import { appReducer } from "../state/appReducer";
import type { Competition, Marker, Project } from "../types";

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
    const offset = getOverlapOffset({ xSnap: 120, ySnap: 64 }, { index: 1, count: 2 }, 10);
    expect(offset.dx).toBeGreaterThan(0);
    expect(Math.abs(offset.dy)).toBeLessThan(0.001);
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

  it("参加者を追加すると編集中の参加者として選ばれ丸内ラベルも作られる", () => {
    const result = appReducer(initialAppState, { type: "addParticipant", name: "31. かな" });
    const added = result.participants[result.participants.length - 1];

    expect(added.name).toBe("31. かな");
    expect(added.markerLabel).toBe("かな");
    expect(result.activeParticipantId).toBe(added.id);
    expect(result.viewMode).toBe("participant");
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
