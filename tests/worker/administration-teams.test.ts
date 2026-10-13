import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { setupAdministration, beforeBatch } from "./administration-fixture";
import { removeStatus } from "../../src/core/features/administration/teams";
import { createIssueRecord } from "../../src/core/features/issues/repository";
import { createIssueInputSchema } from "../../src/core/features/issues/input";
const check = (ids: string, name: string, run: () => Promise<void>) =>
  contractWith(it, ids, name, run);
check(
  "TEAM-001 TEAM-002",
  "team authoring is unique and atomic; workflows reorder and preserve all seven categories",
  async () => {
    const f = await setupAdministration();
    for (const prefix of ["A", "ABCDEFGHIJK", "AB1", "AB!", "Ab", " AB"])
      expect(
        (
          await f.call("/settings/teams", "POST", {
            name: "Invalid",
            identifierPrefix: prefix,
          })
        ).status,
      ).toBe(400);
    const responses = await Promise.all(
      [1, 2].map(() =>
        f.call("/settings/teams", "POST", {
          name: "Research",
          identifierPrefix: "LAB",
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    let team = (await f.state()).teams.find((t) => t.name === "Research")!;
    expect(team.statuses.map((s) => s.category)).toEqual([
      "intake",
      "backlog",
      "unstarted",
      "started",
      "completed",
      "canceled",
      "duplicate",
    ]);
    expect(team.prefixEditable).toBe(true);
    team = (
      await f.mutate("/settings/teams/" + team.id, "PATCH", {
        name: "Discovery",
        identifierPrefix: "DISC",
      })
    ).teams.find((t) => t.id === team.id)!;
    const base = "/settings/teams/" + team.id + "/statuses";
    team = (
      await f.mutate(base, "POST", { name: "Ready", category: "unstarted" })
    ).teams.find((t) => t.id === team.id)!;
    const ids = team.statuses.map((s) => s.id).reverse();
    team = (
      await f.mutate(base + "/order", "PUT", { statusIds: ids })
    ).teams.find((t) => t.id === team.id)!;
    expect(team.statuses.map((s) => s.id)).toEqual(ids);
    expect(
      (await f.call(base + "/order", "PUT", { statusIds: ids.slice(1) }))
        .status,
    ).toBe(400);
    expect(
      (
        await f.call(base + "/order", "PUT", {
          statusIds: ids.map(() => ids[0]),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call(base + "/" + ids[0], "PATCH", {
          name: "Changed",
          category: "started",
        })
      ).status,
    ).toBe(400);
    await f.mutate(base + "/" + ids[0], "PATCH", { name: "Prepared" });
    const issue = await f.create({ teamId: team.id });
    await env.DB.prepare("DELETE FROM issues WHERE id=?").bind(issue.id).run();
    const frozen = await f.call("/settings/teams/" + team.id, "PATCH", {
      identifierPrefix: "NEW",
    });
    expect(frozen.status).toBe(409);
    expect(await frozen.json()).toEqual({
      error: "team_prefix_frozen",
      message:
        "The identifier prefix cannot change after this team has had an issue.",
    });
    await f.mutate("/settings/teams/" + team.id, "PATCH", {
      name: "Renamed after issues",
      archived: true,
    });
    expect(
      (
        await f.call("/settings/teams", "POST", {
          name: "Another",
          identifierPrefix: "DISC",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await f.call("/settings/teams", "POST", {
          name: "Renamed after issues",
          identifierPrefix: "OTHER",
        })
      ).status,
    ).toBe(409);
  },
);
check(
  "TEAM-004 ISSUE-006 ISSUE-007",
  "status deletion remaps every issue once and retains audit after issue deletion; failures rollback",
  async () => {
    const f = await setupAdministration(),
      team = f.initial.teams[0],
      base = "/settings/teams/" + team.id + "/statuses",
      old = team.statuses.find((s) => s.category === "backlog")!;
    const next = (
      await f.mutate(base, "POST", { name: "Queued", category: "backlog" })
    ).teams[0].statuses.find((s) => s.name === "Queued")!;
    const first = await f.create(),
      second = await f.create();
    expect(
      (
        await f.call(base + "/" + old.id, "DELETE", {
          destinationStatusId: team.statuses.find(
            (s) => s.category === "started",
          )!.id,
        })
      ).status,
    ).toBe(400);
    await env.DB.prepare(
      `CREATE TRIGGER reject_second_remap BEFORE UPDATE OF status_id ON issues WHEN OLD.id='${second.id}' BEGIN SELECT RAISE(ABORT,'test remap failure'); END`,
    ).run();
    await expect(
      removeStatus(env.DB, f.owner, team.id, old.id, next.id),
    ).rejects.toThrow(/test remap failure/);
    expect(
      (await env.DB.prepare("SELECT version FROM issues WHERE id=?")
        .bind(first.id)
        .first())!.version,
    ).toBe(1);
    expect(
      (await env.DB.prepare(
        "SELECT count(*) n FROM issue_activity WHERE kind='workflow.status_removed'",
      ).first())!.n,
    ).toBe(0);
    await env.DB.prepare("DROP TRIGGER reject_second_remap").run();
    await expect(
      removeStatus(
        beforeBatch(() =>
          env.DB.prepare("UPDATE workflow_statuses SET name='Raced' WHERE id=?")
            .bind(next.id)
            .run(),
        ),
        f.owner,
        team.id,
        old.id,
        next.id,
      ),
    ).rejects.toThrow(/conflicts/);
    await f.mutate(base + "/" + old.id, "DELETE", {
      destinationStatusId: next.id,
    });
    for (const issue of [first, second]) {
      expect(
        await env.DB.prepare("SELECT status_id,version FROM issues WHERE id=?")
          .bind(issue.id)
          .first(),
      ).toEqual({ status_id: next.id, version: 2 });
      const activity = await env.DB.prepare(
        "SELECT previous_value_json,next_value_json,actor_operator_id FROM issue_activity WHERE issue_id=? AND kind='workflow.status_removed'",
      )
        .bind(issue.id)
        .first<{
          previous_value_json: string;
          next_value_json: string;
          actor_operator_id: string;
        }>();
      expect(JSON.parse(activity!.previous_value_json)).toEqual({
        statusId: old.id,
      });
      expect(JSON.parse(activity!.next_value_json)).toEqual({
        statusId: next.id,
      });
      expect(activity!.actor_operator_id).toBe(f.owner);
      await env.DB.prepare("DELETE FROM issues WHERE id=?")
        .bind(issue.id)
        .run();
    }
    expect(
      (await env.DB.prepare(
        "SELECT count(*) n FROM audit_records WHERE action='workflow.status_removed'",
      ).first())!.n,
    ).toBe(1);
    expect(
      (
        await f.call(base + "/" + next.id, "DELETE", {
          destinationStatusId: next.id,
        })
      ).status,
    ).toBe(400);
  },
);
check(
  "TEAM-003 TEAM-001 OPS-001",
  "archives reject authoring and allocation races; incoming team membership permanently freezes its prefix",
  async () => {
    const f = await setupAdministration(),
      team = f.initial.teams[0],
      issue = await f.create();
    const target = (
      await f.mutate("/settings/teams", "POST", {
        name: "Other",
        identifierPrefix: "OTH",
      })
    ).teams.find((t) => t.name === "Other")!;
    await f.mutate("/settings/teams/" + target.id, "PATCH", { archived: true });
    expect(
      (
        await f.call("/issues", "POST", {
          teamId: target.id,
          title: "No issue",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call("/intake", "POST", {
          teamId: target.id,
          title: "No intake",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await f.call("/issues/" + issue.identifier + "/team", "POST", {
          teamId: target.id,
          statusId: target.statuses.find((s) => s.category === "backlog")!.id,
          expectedVersion: 1,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        (await (await f.call("/options")).json()) as { teams: { id: string }[] }
      ).teams.some((t) => t.id === target.id),
    ).toBe(false);
    await f.mutate("/settings/teams/" + target.id, "PATCH", {
      archived: false,
    });
    const input = createIssueInputSchema.parse({
      teamId: target.id,
      title: "Archive race",
    });
    await expect(
      createIssueRecord(
        beforeBatch(() =>
          env.DB.prepare("UPDATE teams SET archived_at=? WHERE id=?")
            .bind(new Date().toISOString(), target.id)
            .run(),
        ),
        { actorOperatorId: f.owner, input, now: new Date() },
      ),
    ).rejects.toThrow(/archived/);
    expect(
      await env.DB.prepare(
        "SELECT * FROM issues WHERE title='Archive race'",
      ).first(),
    ).toBeNull();
    await f.mutate("/settings/teams/" + target.id, "PATCH", {
      archived: false,
    });
    const moved = await f.call(
      "/issues/" + issue.identifier + "/team",
      "POST",
      {
        teamId: target.id,
        statusId: target.statuses.find((s) => s.category === "backlog")!.id,
        expectedVersion: 1,
      },
    );
    expect(moved.status, await moved.clone().text()).toBe(200);
    expect(
      (
        await f.call("/issues/" + issue.identifier + "/team", "POST", {
          teamId: team.id,
          statusId: team.statuses.find((s) => s.category === "backlog")!.id,
          expectedVersion: 2,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await f.call("/settings/teams/" + target.id, "PATCH", {
          identifierPrefix: "CHANGED",
        })
      ).status,
    ).toBe(409);
  },
);
