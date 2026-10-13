import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { closureFixture } from "./cycle-closure-fixture";
import { beforeCommit } from "./removal-interleaving";
import { bindings } from "./base-auth-fixture";
import { scheduled } from "../../src/core/app/scheduled";
const check = (ids: string, name: string, run: () => Promise<void>) =>
  contractWith(it, ids, name, run);
const tick = (at: string, DB = env.DB) =>
  scheduled({ scheduledTime: Date.parse(at) }, { ...bindings, DB });
check(
  "CYCLE-004 CYCLE-005 CYCLE-006 CYCLE-003 OPS-003 ISSUE-007 ISSUE-011 PROJ-008 BASE-OPS-005",
  "scheduled closure rolls every category once and preserves frozen public project history after edits",
  async () => {
    const f = await closureFixture();
    await f.mutate("/settings/projects", "POST", {
      name: "Historical project",
      leadOperatorId: f.owner,
    });
    const project = (await f.state()).projects[0];
    const issues = [];
    for (const category of [
      "intake",
      "backlog",
      "unstarted",
      "started",
      "completed",
      "canceled",
      "duplicate",
    ]) {
      const issue = await f.create({
        cycleId: f.closing.id,
        statusId: f.team.statuses.find((s) => s.category === "unstarted")!.id,
        projectId: project.id,
        estimate: category === "backlog" ? null : 3,
      });
      await env.DB.prepare("UPDATE issues SET status_id=? WHERE id=?")
        .bind(
          f.team.statuses.find((s) => s.category === category)!.id,
          issue.id,
        )
        .run();
      issues.push({ ...issue, category });
    }
    await tick("2026-09-07T23:59:59.000Z");
    expect((await f.detail()).snapshot).toBeNull();
    await tick("2026-09-08T00:01:00.000Z");
    const closed = await f.detail(),
      snapshot = closed.snapshot!;
    expect(closed.cycle.closedAt).toBe("2026-09-08T00:01:00.000Z");
    expect(snapshot.committed).toHaveLength(7);
    expect(snapshot.completed).toEqual([issues[4].identifier]);
    expect(snapshot.progress).toMatchObject({
      unit: "issue-count",
      completed: 1,
      total: 5,
      percentage: 20,
      capacity: 15,
      remainingPoints: null,
      capacityRisk: "unknown",
    });
    for (const issue of issues) {
      const current = (await (
        await f.call("/issues/" + issue.identifier)
      ).json()) as { version: number; cycle: { id: string } | null };
      expect(current.version).toBe(2);
      expect(current.cycle?.id ?? null).toBe(
        ["unstarted", "started"].includes(issue.category)
          ? f.destination!.id
          : null,
      );
      const activity = (
        await env.DB.prepare(
          "SELECT actor_operator_id,actor_name,previous_value_json,next_value_json FROM issue_activity WHERE issue_id=? AND actor_name='Cycle rollover automation'",
        )
          .bind(issue.id)
          .all()
      ).results;
      expect(activity).toHaveLength(1);
      expect(activity[0].actor_operator_id).toBeNull();
      expect(JSON.parse(activity[0].previous_value_json as string)).toEqual({
        cycleId: f.closing.id,
      });
    }
    await Promise.all([
      tick("2026-09-08T00:02:00Z"),
      tick("2026-09-08T00:02:00Z"),
    ]);
    expect((await f.detail()).snapshot).toEqual(snapshot);
    expect(
      (
        await f.call("/issues/" + issues[2].identifier, "PATCH", {
          expectedVersion: 2,
          estimate: 20,
          projectId: null,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await f.call("/issues/" + issues[2].identifier, "PATCH", {
          expectedVersion: 3,
          cycleId: f.closing.id,
        })
      ).status,
    ).toBe(400);
    await f.mutate("/settings", "PATCH", { timezone: "Australia/Brisbane" });
    expect((await f.detail()).snapshot).toEqual(snapshot);
    expect((await f.detail()).workspaceTimezone).toBe("UTC");
    const history = (await (
      await f.call("/projects/" + project.id)
    ).json()) as { cycleHistory: unknown[] };
    expect(history.cycleHistory).toEqual([
      { cycleId: f.closing.id, name: f.closing.name, snapshot },
    ]);
    for (const sql of [
      "UPDATE cycles SET closed_at=NULL WHERE id=?",
      "UPDATE cycles SET name='Changed' WHERE id=?",
      "UPDATE cycles SET ends_at='2026-10-01' WHERE id=?",
      "UPDATE cycles SET capacity=99 WHERE id=?",
      "DELETE FROM cycles WHERE id=?",
      "UPDATE cycle_snapshots SET body_json='{}' WHERE cycle_id=?",
      "DELETE FROM cycle_snapshots WHERE cycle_id=?",
    ])
      await expect(
        env.DB.prepare(sql).bind(f.closing.id).run(),
      ).rejects.toThrow();
    const audit = await env.DB.prepare(
      "SELECT action,subject_identifier,created_at FROM audit_records WHERE action='cycle.closed' AND subject_id=?",
    )
      .bind(f.closing.id)
      .all();
    expect(audit.results).toEqual([
      {
        action: "cycle.closed",
        subject_identifier: f.closing.id,
        created_at: "2026-09-08T00:01:00.000Z",
      },
    ]);
    const removed=await env.DB.prepare('SELECT identifier,version FROM issues WHERE id=?').bind(issues[2].id).first<{identifier:string;version:number}>();
    expect((await f.call('/issues/'+removed!.identifier,'DELETE',{expectedVersion:removed!.version,confirmed:true})).status).toBe(200);
    expect((await f.detail()).snapshot).toEqual(snapshot);
    expect(
      (
        await env.DB.prepare(
          "SELECT action,subject_identifier,created_at FROM audit_records WHERE action='cycle.closed' AND subject_id=?",
        )
          .bind(f.closing.id)
          .all()
      ).results,
    ).toEqual(audit.results);
    // Remove every remaining live association so history can only come from the frozen project IDs.
    await env.DB.prepare("UPDATE issues SET project_id=NULL WHERE project_id=?")
      .bind(project.id)
      .run();
    expect(
      (
        (await (await f.call("/projects/" + project.id)).json()) as {
          cycleHistory: unknown[];
        }
      ).cycleHistory,
    ).toEqual(history.cycleHistory);
  },
);
check(
  "CYCLE-004 CYCLE-006 ISSUE-007",
  "concurrent first closure without a next cycle records one visible failure and never retroactively moves issues",
  async () => {
    const f = await closureFixture(false),
      issue = await f.create({
        cycleId: f.closing.id,
        statusId: f.team.statuses.find((s) => s.category === "started")!.id,
      });
    await Promise.all([
      tick("2026-09-08T00:01:00Z"),
      tick("2026-09-08T00:01:00Z"),
    ]);
    const detail = await f.detail();
    expect(detail.failure?.identifiers).toEqual([issue.identifier]);
    expect(detail.snapshot!.progress.unit).toBe("issue-count");
    expect(
      await env.DB.prepare("SELECT version,cycle_id FROM issues WHERE id=?")
        .bind(issue.id)
        .first(),
    ).toEqual({ version: 2, cycle_id: null });
    await f.mutate("/settings/cycles", "POST", {
      teamId: f.team.id,
      name: "Late next",
      startsLocal: "2026-09-08T00:00",
      endsLocal: "2026-09-20T00:00",
    });
    await tick("2026-09-09T00:00:00Z");
    expect((await f.detail()).failure).toEqual(detail.failure);
    expect(
      await env.DB.prepare("SELECT cycle_id FROM issues WHERE id=?")
        .bind(issue.id)
        .first("cycle_id"),
    ).toBeNull();
  },
);
check(
  "CYCLE-004 CYCLE-005 ISSUE-007",
  "late SQL failure rolls back closure and a subsequent batch snapshots edits made after discovery",
  async () => {
    const f = await closureFixture(),
      issue = await f.create({
        cycleId: f.closing.id,
        statusId: f.team.statuses.find((s) => s.category === "started")!.id,
        estimate: 2,
      });
    const counts = () =>
      env.DB.prepare(
        `SELECT (SELECT count(*) FROM cycles WHERE id=? AND closed_at IS NOT NULL) closed, (SELECT count(*) FROM cycle_snapshots WHERE cycle_id=?) snapshots, (SELECT count(*) FROM issue_activity WHERE issue_id=? AND actor_name='Cycle rollover automation') activity, (SELECT count(*) FROM audit_records WHERE action='cycle.closed' AND subject_id=?) audit`,
      )
        .bind(f.closing.id, f.closing.id, issue.id, f.closing.id)
        .first();
    const before = await counts();
    expect(before).toEqual({ closed: 0, snapshots: 0, activity: 0, audit: 0 });
    await env.DB.exec(
      "CREATE TRIGGER test_late_closure BEFORE UPDATE OF closed_at ON cycles WHEN NEW.closed_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'late failure'); END",
    );
    await expect(tick("2026-09-08T01:00:00Z")).rejects.toThrow("late failure");
    const afterFailure = await counts();
    expect(afterFailure).toEqual(before);
    expect((await f.detail()).snapshot).toBeNull();
    expect(
      await env.DB.prepare("SELECT cycle_id,version FROM issues WHERE id=?")
        .bind(issue.id)
        .first(),
    ).toEqual({ cycle_id: f.closing.id, version: 1 });
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM issue_activity WHERE actor_name='Cycle rollover automation' AND issue_id=?",
      )
        .bind(issue.id)
        .first("n"),
    ).toBe(0);
    await env.DB.exec("DROP TRIGGER test_late_closure");
    const raced = beforeCommit(
      (sql) => sql.includes("INSERT INTO cycle_snapshots"),
      async () => {
        expect(
          (
            await f.call("/issues/" + issue.identifier, "PATCH", {
              expectedVersion: 1,
              estimate: 8,
            })
          ).status,
        ).toBe(200);
      },
    );
    await tick("2026-09-08T01:00:00Z", raced);
    const detail = await f.detail();
    expect(detail.snapshot!.committed[0].estimate).toBe(8);
    expect(detail.snapshot!.progress.total).toBe(8);
    const afterClosure = await counts();
    expect(afterClosure).toEqual({
      closed: 1,
      snapshots: 1,
      activity: 1,
      audit: 1,
    });
    console.info(
      "cycle-closure-atomic-receipt",
      JSON.stringify({ before, afterFailure, afterClosure }),
    );
    expect(
      await env.DB.prepare("SELECT cycle_id FROM issues WHERE id=?")
        .bind(issue.id)
        .first("cycle_id"),
    ).toBe(f.destination!.id);
  },
);
check(
  "CYCLE-005 CYCLE-003",
  "snapshot records scope additions and removals in the interval and empty scope remains explicit",
  async () => {
    const f = await closureFixture(),
      issue = await f.create({ cycleId: f.closing.id });
    // Fixture clock sets authored mutations inside the historical test interval.
    await env.DB.prepare(
      "UPDATE cycle_membership_events SET occurred_at='2026-09-02T00:00:00Z' WHERE identifier=?",
    )
      .bind(issue.identifier)
      .run();
    expect(
      (
        await f.call("/issues/" + issue.identifier, "PATCH", {
          expectedVersion: 1,
          cycleId: null,
        })
      ).status,
    ).toBe(200);
    await env.DB.prepare(
      "UPDATE cycle_membership_events SET occurred_at='2026-09-03T00:00:00Z' WHERE identifier=? AND direction='removed'",
    )
      .bind(issue.identifier)
      .run();
    await tick("2026-09-08T00:01:00Z");
    const snapshot = (await f.detail()).snapshot!;
    expect(snapshot.changes.map((c) => [c.identifier, c.direction])).toEqual([
      [issue.identifier, "added"],
      [issue.identifier, "removed"],
    ]);
    expect(snapshot.progress).toMatchObject({
      total: 0,
      completed: 0,
      percentage: null,
      unit: "points",
      remainingPoints: 0,
      capacityRisk: "within-capacity",
    });
    const done = await f.create({ cycleId: f.destination!.id, estimate: 2 });
    const remaining = await f.create({
      cycleId: f.destination!.id,
      estimate: 3,
    });
    const excluded = await f.create({
      cycleId: f.destination!.id,
      estimate: 10,
    });
    for (const [record, category] of [
      [done, "completed"],
      [remaining, "started"],
      [excluded, "canceled"],
    ] as const)
      expect(
        (
          await f.call("/issues/" + record.identifier, "PATCH", {
            expectedVersion: 1,
            statusId: f.team.statuses.find((s) => s.category === category)!.id,
          })
        ).status,
      ).toBe(200);
    await tick("2026-09-15T00:01:00Z");
    const next = (await (
      await f.call("/cycles/" + f.destination!.id)
    ).json()) as { snapshot: { progress: unknown; estimateTotal: number } };
    expect(next.snapshot.progress).toMatchObject({
      total: 5,
      completed: 2,
      percentage: 40,
      unit: "points",
      remainingPoints: 3,
      capacityRisk: "within-capacity",
    });
    expect(next.snapshot.estimateTotal).toBe(15);
  },
);
