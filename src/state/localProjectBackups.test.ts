import { describe, expect, it } from "vitest";

import { initialAppState } from "../data/seed";
import {
  buildNextBackupList,
  MAX_BACKUPS_PER_PROJECT,
  MAX_BACKUPS_TOTAL
} from "./localProjectBackups";
import { buildProjectSyncPayload, type ProjectSyncPayload } from "./projectSync";

describe("端末バックアップ", () => {
  it("同じプロジェクトは直近3件だけ残す", () => {
    let backups = buildNextBackupList([], payloadWithRevision(1), "before-remote-sync", dateForDay(1));

    for (let revision = 2; revision <= 4; revision += 1) {
      backups = buildNextBackupList(
        backups,
        payloadWithRevision(revision),
        "before-remote-sync",
        dateForDay(revision)
      );
    }

    expect(backups).toHaveLength(MAX_BACKUPS_PER_PROJECT);
    expect(backups.map((backup) => backup.createdAt)).toEqual([dateForDay(4), dateForDay(3), dateForDay(2)]);
  });

  it("内容が同じ場合は重複して保存しない", () => {
    const payload = payloadWithRevision(1);
    const first = buildNextBackupList([], payload, "before-remote-sync", dateForDay(1));
    const second = buildNextBackupList(
      first,
      { ...payload, updatedAt: dateForDay(2) },
      "before-remote-sync",
      dateForDay(2)
    );

    expect(second).toHaveLength(1);
    expect(second[0].createdAt).toBe(dateForDay(1));
  });

  it("端末全体では8件を超えず、30日より古い履歴を残さない", () => {
    let backups = buildNextBackupList([], payloadForProject(0), "before-remote-sync", "2026-01-01T00:00:00.000Z");

    for (let index = 1; index <= 10; index += 1) {
      backups = buildNextBackupList(
        backups,
        payloadForProject(index),
        "before-remote-sync",
        `2026-02-${String(index).padStart(2, "0")}T00:00:00.000Z`
      );
    }

    expect(backups).toHaveLength(MAX_BACKUPS_TOTAL);
    expect(backups.some((backup) => backup.createdAt.startsWith("2026-01"))).toBe(false);
  });
});

function payloadWithRevision(revision: number): ProjectSyncPayload {
  const payload = buildProjectSyncPayload(initialAppState, dateForDay(revision));
  if (!payload) {
    throw new Error("テスト用プロジェクトを作成できませんでした");
  }

  return {
    ...payload,
    project: {
      ...payload.project,
      name: `${payload.project.name} ${revision}`
    }
  };
}

function payloadForProject(index: number): ProjectSyncPayload {
  const payload = payloadWithRevision(index + 1);
  return {
    ...payload,
    project: {
      ...payload.project,
      id: `project-${index}`,
      shareId: `BACKUP-${index}`
    }
  };
}

function dateForDay(day: number): string {
  return `2026-02-${String(day).padStart(2, "0")}T00:00:00.000Z`;
}
