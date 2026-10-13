import { env } from "cloudflare:workers";
import { beforeAll, it, expect } from "vitest";
import { contractWith } from "../contract-tags";
import { setup, create, call, ids, receipt } from "./bulk-parent-fixture";
beforeAll(setup);
contractWith(
  it,
  "VIEW-005 ISSUE-004 ISSUE-006 ISSUE-007",
  "board PATCH traverses allowed categories with timestamps, versions and immutable activity",
  async () => {
    let issue = await create();
    for (const [id, category] of [
      [ids.flowStarted, "started"],
      [ids.flowCompleted, "completed"],
      [ids.flowUnstarted, "unstarted"],
      [ids.flowCanceled, "canceled"],
      [ids.flowBacklog, "backlog"],
    ] as const) {
      const res = await call(
        `/issues/${issue.identifier}`,
        { expectedVersion: issue.version, statusId: id },
        "PATCH",
      );
      expect(res.status, await res.clone().text()).toBe(200);
      const next = (await res.json()) as any;
      expect(next.version).toBe(issue.version + 1);
      expect(next.activity.length).toBe(issue.activity.length + 1);
      expect(next.completedAt === null).toBe(category !== "completed");
      expect(next.canceledAt === null).toBe(category !== "canceled");
      expect(next.activity.at(-1)).toMatchObject({
        kind: "issue.updated",
        previousValue: {
          statusId: issue.status.id,
          completedAt: issue.completedAt,
          canceledAt: issue.canceledAt,
        },
        nextValue: { statusId: id },
      });
      issue = next;
    }
  },
);
contractWith(
  it,
  "VIEW-005 ISSUE-004 ISSUE-006",
  "board moves reject intake, duplicate, wrong-team and stale requests without writes",
  async () => {
    const issue = await create(),
      before = await receipt();
    for (const statusId of [
      ids.flowIntake,
      ids.flowDuplicate,
      ids.platformStarted,
    ]) {
      const res = await call(
        `/issues/${issue.identifier}`,
        { expectedVersion: 1, statusId },
        "PATCH",
      );
      expect([400, 409]).toContain(res.status);
      expect(await receipt()).toEqual(before);
    }
    const stale = await call(
      `/issues/${issue.identifier}`,
      { expectedVersion: 2, statusId: ids.flowStarted },
      "PATCH",
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: "stale_version",
      version: 1,
    });
    expect(await receipt()).toEqual(before);
    for (const statusId of [ids.flowIntake, ids.flowDuplicate]) {
      await env.DB.prepare("UPDATE issues SET status_id=? WHERE id=?")
        .bind(statusId, issue.id)
        .run();
      const snapshot = await receipt();
      const res = await call(
        `/issues/${issue.identifier}`,
        { expectedVersion: 1, statusId: ids.flowStarted },
        "PATCH",
      );
      expect(res.status).toBe(409);
      expect(await receipt()).toEqual(snapshot);
    }
  },
);
