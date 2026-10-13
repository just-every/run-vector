import { env } from "cloudflare:workers";
import { beforeAll, it, expect } from "vitest";
import { contractWith } from "../contract-tags";
import {
  setup,
  create,
  call,
  ids,
  receipt,
  select,
} from "./bulk-parent-fixture";
import { bulkUpdateIssues } from "../../src/core/features/bulk-edit/repository";
beforeAll(setup);
contractWith(
  it,
  "VIEW-004 ISSUE-004 ISSUE-006 CYCLE-002",
  "reports every failing identifier and reason without any partial receipt",
  async () => {
    const a = await create(),
      b = await create({ teamId: ids.platform });
    const before = await receipt();
    const res = await call("/issues/bulk", {
      issues: [{ identifier: a.identifier, expectedVersion: 99 }, ...select(b)],
      changes: { cycleId: ids.flowCycle },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error).toBe("bulk_edit_failed");
    expect(body.failures.map((f: any) => f.identifier).sort()).toEqual(
      [a.identifier, b.identifier].sort(),
    );
    expect(
      body.failures
        .find((f: any) => f.identifier === a.identifier)
        .reasons.join(" "),
    ).toMatch(/stale/);
    expect(
      body.failures
        .find((f: any) => f.identifier === b.identifier)
        .reasons.join(" "),
    ).toMatch(/Cycle/);
    expect(await receipt()).toEqual(before);
  },
);
contractWith(
  it,
  "VIEW-004 CYCLE-002 ISSUE-004",
  "invalid transitions, archived projects, cycle and label options reject without writes",
  async () => {
    const a = await create(),
      b = await create({ statusId: ids.flowCompleted });
    await env.DB.prepare("UPDATE projects SET archived_at=? WHERE id=?")
      .bind(new Date().toISOString(), ids.reliability)
      .run();
    const before = await receipt();
    for (const changes of [
      { statusId: ids.flowIntake },
      { projectId: ids.reliability },
      { cycleId: ids.flowCycle },
      { labelIds: ["00000000000000000000000000"] },
      { labelIds: [ids.reliabilityLabel, ids.reliabilityLabel] },
      {
        labelIds: Array.from({ length: 21 }, (_, i) =>
          String(i).padStart(26, "0"),
        ),
      },
    ]) {
      const res = await call("/issues/bulk", { issues: select(a, b), changes });
      expect([400, 409]).toContain(res.status);
      expect(await receipt()).toEqual(before);
    }
    expect(
      (
        await call("/issues/bulk", {
          issues: Array.from({ length: 251 }, (_, i) => ({
            identifier: `FLW-${i + 1000}`,
            expectedVersion: 1,
          })),
          changes: { priority: "high" },
        })
      ).status,
    ).toBe(400);
  },
);
contractWith(
  it,
  "VIEW-004 ISSUE-007",
  "successful same-value selections still create exactly one versioned activity per selected issue",
  async () => {
    const a = await create(),
      b = await create();
    const res = await call("/issues/bulk", {
      issues: select(a, b),
      changes: { priority: "none" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      changed: 2,
      issues: [
        { identifier: a.identifier, version: 2 },
        { identifier: b.identifier, version: 2 },
      ],
    });
  },
);
contractWith(
  it,
  "VIEW-004 ISSUE-007",
  "accepts the full 250-issue seed limit in one transaction",
  async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(value) AS (SELECT 0 UNION ALL SELECT value+1 FROM n WHERE value<249)
    INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,description,status_id,priority,custom_fields_json,version,created_at,updated_at)
    SELECT printf('%026d',9000+value),'FLW-'||(9000+value),'FLW',9000+value,?,'Batch capacity fixture','',?,'none','{}',1,?,? FROM n`,
    )
      .bind(
        ids.flow,
        ids.flowBacklog,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
    const selected = Array.from({ length: 250 }, (_, i) => ({
      identifier: `FLW-${9000 + i}`,
      expectedVersion: 1,
    }));
    const result = await bulkUpdateIssues(env.DB, ids.sarah, {
      issues: selected,
      changes: { priority: "low" },
    });
    expect(result.changed).toBe(250);
    expect(result.issues.every((issue) => issue.version === 2)).toBe(true);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM issue_activity WHERE kind='issue.updated' AND issue_id IN(SELECT id FROM issues WHERE sequence_number BETWEEN 9000 AND 9249)",
      ).first("n"),
    ).toBe(250);
  },
);
