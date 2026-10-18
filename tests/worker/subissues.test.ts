import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import type { SubissuesData } from "../../src/core/features/subissues/schema";
import { collaborationFixture } from "./collaboration-fixture";
import { receipt, type Detail } from "./subissues-fixture";
contractWith(
  it,
  "ISSUE-019 BASE-OPS-005",
  "ordered sub-issues create and convert inline, complete ancestors once and reopen them with durable named automation",
  async () => {
    const f = await collaborationFixture(),
      team = f.initial.teams[0];
    const done = team.statuses.find((s) => s.category === "completed")!,
      open = team.statuses.find((s) => s.category === "unstarted")!;
    const grandparent = await f.create({ title: "Release" }),
      parent = await f.create({ title: "Ship release" }),
      path = `/issues/${parent.identifier}`;
    let detail = await receipt<Detail>(
      await f.call(path + "/parent", "PATCH", {
        expectedVersion: parent.version,
        parentIdentifier: grandparent.identifier,
      }),
    );
    let state = await receipt<SubissuesData>(await f.call(path + "/subissues"));
    for (const title of ["Implementation", "Review", "Release notes"])
      state = await receipt<SubissuesData>(
        await f.call(path + "/subissues", "POST", {
          expectedVersion: state.version,
          title,
        }),
        201,
      );
    expect(state.total).toBe(3);
    expect(state.completed).toBe(0);
    const original = state.children.map((c) => c.identifier),
      reversed = [...original].reverse();
    state = await receipt<SubissuesData>(
      await f.call(path + "/subissues", "PATCH", {
        expectedVersion: state.version,
        identifiers: reversed,
      }),
    );
    expect(state.children.map((c) => c.identifier)).toEqual(reversed);
    const cycleStart = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 16),
      cycleEnd = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 16);
    await receipt(
      await f.call("/settings/cycles", "POST", {
        teamId: team.id,
        name: "Sub-issue delivery",
        startsLocal: cycleStart,
        endsLocal: cycleEnd,
      }),
    );
    await receipt(
      await f.call("/settings/teams/" + team.id, "PATCH", {
        autoCycleCompleted: true,
      }),
    );
    const first = state.children[0];
    await receipt(
      await f.call(`/issues/${first.identifier}`, "PATCH", {
        expectedVersion: first.version,
        assigneeOperatorId: f.bob,
      }),
    );
    state = await receipt<SubissuesData>(await f.call(path + "/subissues"));
    expect(state.children[0].assignee?.id).toBe(f.bob);
    await receipt(
      await f.call(`/teams/${team.id}/subissue-rule`, "PATCH", {
        expectedVersion: state.rule.version,
        enabled: true,
      }),
    );
    const bulkParent = await f.create({ title: "Bulk release" });
    const bulkState = await receipt<SubissuesData>(
      await f.call(`/issues/${bulkParent.identifier}/subissues`, "POST", {
        expectedVersion: bulkParent.version,
        title: "Bulk child",
      }),
      201,
    );
    const selected = [
      ...bulkState.children.map((c) => ({
        identifier: c.identifier,
        expectedVersion: c.version,
      })),
      { identifier: bulkParent.identifier, expectedVersion: bulkState.version },
    ];
    const bulk = await f.call("/issues/bulk", "POST", {
      issues: selected,
      changes: { statusId: done.id },
    });
    await receipt(bulk);
    const undo = JSON.parse(bulk.headers.get("x-vector-undo")!) as {
      actionId: string;
    };
    await receipt(
      await f.call("/issues/undo", "POST", { actionId: undo.actionId }),
    );
    expect(
      (await receipt<Detail>(await f.call(`/issues/${bulkParent.identifier}`)))
        .status.category,
    ).toBe("backlog");

    for (const child of state.children) {
      const current = await receipt<Detail>(
        await f.call(`/issues/${child.identifier}`),
      );
      await receipt(
        await f.call(`/issues/${child.identifier}`, "PATCH", {
          expectedVersion: current.version,
          statusId: done.id,
        }),
      );
    }
    state = await receipt<SubissuesData>(await f.call(path + "/subissues"));
    detail = await receipt<Detail>(await f.call(path));
    const ancestor = await receipt<Detail>(
      await f.call(`/issues/${grandparent.identifier}`),
    );
    expect([state.completed, state.total]).toEqual([3, 3]);
    expect([detail.status.category, ancestor.status.category]).toEqual([
      "completed",
      "completed",
    ]);
    expect(detail.completedAt).not.toBeNull();
    const parentCycle = await env.DB.prepare(
      "SELECT cycle_id FROM issues WHERE id=?",
    )
      .bind(parent.id)
      .first<string>("cycle_id");
    expect(parentCycle).not.toBeNull();
    expect(
      detail.activity.filter(
        (a) => a.kind === "issue.cycle_automatically_added",
      ),
    ).toHaveLength(1);
    expect(
      (
        await env.DB.prepare(
          "SELECT actor_name FROM notifications WHERE issue_id=? AND causes_json LIKE '%completed%'",
        )
          .bind(parent.id)
          .all()
      ).results,
    ).toEqual([{ actor_name: "Sub-issue progress" }]);
    expect(
      detail.activity.filter((a) => a.kind === "issue.subissue_completed"),
    ).toHaveLength(1);
    expect(
      detail.activity.find((a) => a.kind === "issue.subissue_completed")?.actor,
    ).toBe("Sub-issue progress");
    const reopenedChild = await receipt<Detail>(
      await f.call(`/issues/${first.identifier}`),
    );
    await receipt(
      await f.call(`/issues/${first.identifier}`, "PATCH", {
        expectedVersion: reopenedChild.version,
        statusId: open.id,
      }),
    );
    detail = await receipt<Detail>(await f.call(path));
    expect(detail.status.category).toBe("unstarted");
    expect(detail.completedAt).toBeNull();
    expect(detail.version).toBe(state.version + 1);
    expect(
      (await receipt<Detail>(await f.call(`/issues/${grandparent.identifier}`)))
        .status.category,
    ).toBe("unstarted");
    expect(
      detail.activity.filter((a) => a.kind === "issue.subissue_reopened"),
    ).toHaveLength(1);
    const automation = (
      await env.DB.prepare(
        `SELECT actor_operator_id,actor_name FROM issue_activity WHERE issue_id=? AND kind LIKE 'issue.subissue_%' AND actor_operator_id IS NULL`,
      )
        .bind(parent.id)
        .all<{ actor_operator_id: null; actor_name: string }>()
    ).results;
    expect(automation).toHaveLength(2);
    expect(
      automation.every(
        (a) =>
          a.actor_operator_id === null && a.actor_name === "Sub-issue progress",
      ),
    ).toBe(true);
    const child = await receipt<Detail>(
      await f.call(`/issues/${first.identifier}`),
    );
    await receipt(
      await f.call(`/issues/${first.identifier}/parent`, "PATCH", {
        expectedVersion: child.version,
        parentIdentifier: null,
      }),
    );
    state = await receipt<SubissuesData>(await f.call(path + "/subissues"));
    expect(state.total).toBe(2);
    expect(state.completed).toBe(2);
    const root = await receipt<Detail>(
      await f.call(`/issues/${first.identifier}`),
    );
    await receipt(
      await f.call(`/issues/${first.identifier}/parent`, "PATCH", {
        expectedVersion: root.version,
        parentIdentifier: parent.identifier,
      }),
    );
    state = await receipt<SubissuesData>(await f.call(path + "/subissues"));
    expect(state.children.at(-1)?.identifier).toBe(first.identifier);
    // A canceled child is unfinished; a canceled parent is a deliberate terminal
    // decision and must never be overwritten by progress automation.
    const canceled = team.statuses.find((s) => s.category === "canceled")!;
    detail = await receipt<Detail>(await f.call(path));
    detail = await receipt<Detail>(
      await f.call(path, "PATCH", {
        expectedVersion: detail.version,
        statusId: canceled.id,
      }),
    );
    const current = await receipt<Detail>(
      await f.call(`/issues/${first.identifier}`),
    );
    await receipt(
      await f.call(`/issues/${first.identifier}`, "PATCH", {
        expectedVersion: current.version,
        statusId: done.id,
      }),
    );
    expect((await receipt<Detail>(await f.call(path))).status.category).toBe(
      "canceled",
    );
    const auditBefore = await env.DB.prepare(
      `SELECT id,action FROM audit_records WHERE subject_id=? AND action LIKE 'issue.subissue_%' ORDER BY id`,
    )
      .bind(parent.id)
      .all();
    expect(auditBefore.results.length).toBeGreaterThan(0);
    await receipt(
      await f.call(path, "DELETE", {
        expectedVersion: detail.version,
        confirmed: true,
      }),
    );
    const auditAfter = await env.DB.prepare(
      `SELECT id,action FROM audit_records WHERE subject_id=? AND action LIKE 'issue.subissue_%' ORDER BY id`,
    )
      .bind(parent.id)
      .all();
    expect(auditAfter.results).toEqual(auditBefore.results);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM subissue_progress_events",
      ).first<number>("n"),
    ).toBe(0);
  },
);