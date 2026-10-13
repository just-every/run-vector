import { openCycleFixture } from "./open-cycle-fixture";
import { testSessionFence } from "./native-fixture";
import { env } from "cloudflare:workers";
import { beforeAll, it, expect } from "vitest";
import { contractWith } from "../contract-tags";
import { setup, create, ids, receipt, select } from "./bulk-parent-fixture";
import { beforeCommit } from "./removal-interleaving";
import {
  bulkUpdateIssues,
  BulkIssueError,
} from "../../src/core/features/bulk-edit/repository";
import { mutationDatabase } from "../../src/core/features/auth/mutation-database";
import { configureNotifications } from "../../src/core/features/notifications/context";
import { testCookie } from "./native-fixture";
beforeAll(setup);
contractWith(
  it,
  "VIEW-004 ISSUE-006 ISSUE-007",
  "a validation-to-commit stale race rolls back the whole batch",
  async () => {
    const a = await create(),
      b = await create();
    const db = beforeCommit(
      (sql) => sql.includes("bulk edit admission denied"),
      async () => {
        await env.DB.prepare("UPDATE issues SET version=version+1 WHERE id=?")
          .bind(b.id)
          .run();
      },
    );
    const before = await receipt();
    await expect(
      bulkUpdateIssues(db, ids.sarah, {
        issues: select(a, b),
        changes: { priority: "high", assigneeOperatorId: ids.maya },
      }),
    ).rejects.toMatchObject({
      failures: [
        { identifier: b.identifier, reasons: [expect.stringMatching(/stale/)] },
      ],
    });
    const after = await receipt();
    expect(
      after.issues.map((r: any) =>
        r.id === b.id ? { ...r, version: r.version - 1 } : r,
      ),
    ).toEqual(before.issues);
    for (const table of Object.keys(before).filter((t) => t !== "issues"))
      expect(after[table]).toEqual(before[table]);
  },
);
contractWith(
  it,
  "VIEW-004 OPS-001 NOTIFY-006",
  "actor removal at commit aborts activity, follower and delivery writes",
  async () => {
    const a = await create(),
      b = await create(),
      before = await receipt();
    const db = beforeCommit(
      (sql) => sql.includes("bulk edit admission denied"),
      async () => {
        await env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?")
          .bind(Date.now(), ids.sarah)
          .run();
      },
    );
    try {
      await expect(
        bulkUpdateIssues(db, ids.sarah, {
          issues: select(a, b),
          changes: { assigneeOperatorId: ids.maya },
        }),
      ).rejects.toThrow(/session/);
      expect(await receipt()).toEqual(before);
    } finally {
      await env.DB.prepare("UPDATE operators SET removed_at=NULL WHERE id=?")
        .bind(ids.sarah)
        .run();
      // Removal also revokes Base authority; restore only this test fixture.
      await env.DB.prepare(
        "UPDATE oa_operators SET status='active' WHERE id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)",
      )
        .bind(ids.sarah)
        .run();
    }
  },
);
contractWith(
  it,
  "VIEW-004 OPS-001 ISSUE-006",
  "native session revocation at commit aborts the entire batch",
  async () => {
    const a = await create(),
      b = await create(),
      before = await receipt();
    const cookie = await testCookie(env.DB, ids.sarah);
    const intercepted = beforeCommit(
      (sql) => sql.includes("bulk edit admission denied"),
      async () => {
        await env.DB.prepare(
          "UPDATE oa_sessions SET revoked_at=? WHERE operator_id=?",
        )
          .bind(Date.now(), ids.sarah)
          .run();
      },
    );
    const db = mutationDatabase(
      intercepted,
      ids.sarah,
      await testSessionFence(env.DB, cookie),
    );
    await expect(
      bulkUpdateIssues(db, ids.sarah, {
        issues: select(a, b),
        changes: { priority: "urgent" },
      }),
    ).rejects.toThrow(/session/);
    expect(await receipt()).toEqual(before);
  },
);
contractWith(
  it,
  "VIEW-004 CYCLE-002",
  "option archive and cycle-close races preserve every selected issue",
  async () => {
    const closedCycle = await openCycleFixture(env.DB, ids.flowCycle);
    const a = await create(),
      b = await create();
    for (const [sql, changes] of [
      [
        "UPDATE projects SET archived_at='2026-10-01' WHERE id=?",
        { projectId: ids.reliability },
      ],
      [
        "UPDATE cycles SET closed_at='2026-10-01' WHERE id=?",
        { cycleId: closedCycle },
      ],
    ] as const) {
      const before = await receipt();
      const db = beforeCommit(
        (query) => query.includes("bulk edit admission denied"),
        async () => {
          await env.DB.prepare(sql)
            .bind("projectId" in changes ? changes.projectId : changes.cycleId)
            .run();
        },
      );
      try {
        await expect(
          bulkUpdateIssues(db, ids.sarah, { issues: select(a, b), changes }),
        ).rejects.toBeInstanceOf(BulkIssueError);
        expect(await receipt()).toEqual(before);
      } finally {
        if ("projectId" in changes)
          await env.DB.prepare(
            "UPDATE projects SET archived_at=NULL WHERE id=?",
          )
            .bind(changes.projectId)
            .run();
      }
    }
  },
);
contractWith(
  it,
  "VIEW-004 ISSUE-007 NOTIFY-006",
  "a real SQL failure after the first planned issue rolls back all durable effects",
  async () => {
    const a = await create(),
      b = await create(),
      before = await receipt();
    await env.DB.exec(
      `CREATE TRIGGER refuse_bulk_second BEFORE UPDATE OF priority ON issues WHEN OLD.id='${b.id}' BEGIN SELECT RAISE(ABORT,'bulk storage failure'); END`,
    );
    const db = mutationDatabase(env.DB, ids.sarah);
    configureNotifications(db, {
      ...env,
      APP_ORIGIN: "http://localhost:15928",
      MAIL_MODE: "local-outbox",
      MAIL_FROM: "Vector <vector@example.test>",
    });
    try {
      await expect(
        bulkUpdateIssues(db, ids.sarah, {
          issues: select(a, b),
          changes: { priority: "urgent", assigneeOperatorId: ids.maya },
        }),
      ).rejects.toThrow(/bulk storage failure/);
      expect(await receipt()).toEqual(before);
    } finally {
      await env.DB.exec("DROP TRIGGER refuse_bulk_second");
    }
  },
);
