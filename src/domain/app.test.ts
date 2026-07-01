import { describe, expect, it } from "vitest";

import { coordinateToSnap, getOverlapOffset } from "./grid";
import { deriveMarkerLabelFromName, formatMarkerLabel } from "./labels";
import { replaceParticipantMarkers } from "./merge";
import type { Marker } from "../types";

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
