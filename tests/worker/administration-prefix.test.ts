import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { setupAdministration } from "./administration-fixture";
import { request } from "./base-auth-fixture";
import { allocateIssueSequence } from "../../src/core/features/issues/create-guard";
import {
  afterReservation,
  creationCounts,
  createThroughRepository,
  prefixSequence,
  sequence,
  type CreationPath,
} from "./administration-prefix-fixture";

const check = (ids: string, name: string, run: () => Promise<void>) =>
  contractWith(it, ids, name, run);
let fixture: Awaited<ReturnType<typeof setupAdministration>>;
beforeAll(async () => {
  fixture = await setupAdministration();
});

for (const path of ["issues", "intake"] satisfies CreationPath[]) {
  check(
    "TEAM-001 ISSUE-002 INTAKE-001",
    `${path}: failed first persistence retains its reservation but HTTP prefix editing remains available`,
    async () => {
      const f = fixture;
      const oldPrefix = path === "issues" ? "RESA" : "RESB";
      const newPrefix = path === "issues" ? "NEXTA" : "NEXTB";
      const team = (
        await f.mutate("/settings/teams", "POST", {
          name: "Reservation only " + path,
          identifierPrefix: oldPrefix,
        })
      ).teams.find((t) => t.identifierPrefix === oldPrefix)!;
      expect(await sequence(team.id)).toBeNull();
      const before = await creationCounts(team.id);
      // The activity write follows the issue and, for intake, its evidence.
      // A real SQLite failure must roll back all of them and the history trigger.
      await env.DB.prepare(
        `CREATE TRIGGER reject_first_creation_activity
        BEFORE INSERT ON issue_activity BEGIN
        SELECT RAISE(ABORT,'first creation activity failed'); END`,
      ).run();
      try {
        await expect(
          createThroughRepository(
            path,
            env.DB,
            f.owner,
            team.id,
            "Failed first work",
          ),
        ).rejects.toThrow(/first creation activity failed/);
      } finally {
        await env.DB.exec("DROP TRIGGER reject_first_creation_activity");
      }
      expect(await sequence(team.id)).toBe(1);
      expect(await creationCounts(team.id)).toEqual(before);
      expect(
        (await f.state()).teams.find((t) => t.id === team.id)!.prefixEditable,
      ).toBe(true);
      const changed = (
        await f.mutate("/settings/teams/" + team.id, "PATCH", {
          identifierPrefix: newPrefix,
        })
      ).teams.find((t) => t.id === team.id)!;
      expect(changed.identifierPrefix).toBe(newPrefix);
      expect(changed.prefixEditable).toBe(true);
      expect(await sequence(team.id)).toBeNull();
      expect(await prefixSequence(oldPrefix)).toBe(1);
      const response = await f.call("/" + path, "POST", {
        teamId: team.id,
        title: "Successful first work",
      });
      expect(response.status, await response.clone().text()).toBe(201);
      expect(
        ((await response.json()) as { identifier: string }).identifier,
      ).toBe(newPrefix + "-1");
      expect(await sequence(team.id)).toBe(1);
      expect(await prefixSequence(newPrefix)).toBe(1);
      expect(await creationCounts(team.id)).toEqual({
        issues: 1,
        evidence: path === "intake" ? 1 : 0,
        activity: 1,
        history: 1,
      });
      expect(
        (await f.state()).teams.find((t) => t.id === team.id)!.prefixEditable,
      ).toBe(false);
    },
  );

  check(
    "TEAM-001 ISSUE-002 INTAKE-001 BASE-ACCESS-004",
    `${path} HTTP: a prefix change after reservation atomically refuses the captured identifier and retry uses the new prefix`,
    async () => {
      const f = fixture;
      const suffix = (path === "issues" ? "A" : "B") + "B";
      const oldPrefix = "BEFORE" + suffix,
        newPrefix = "AFTER" + suffix;
      const team = (
        await f.mutate("/settings/teams", "POST", {
          name: "Prefix race " + path + " HTTP",
          identifierPrefix: oldPrefix,
        })
      ).teams.find((t) => t.identifierPrefix === oldPrefix)!;
      const before = await creationCounts(team.id);
      const interrupted = afterReservation(team.id, async () => {
        const changed = await f.mutate("/settings/teams/" + team.id, "PATCH", {
          identifierPrefix: newPrefix,
        });
        expect(changed.teams.find((t) => t.id === team.id)).toMatchObject({
          identifierPrefix: newPrefix,
          prefixEditable: true,
        });
      });
      const refused = await request(
        "/api/" + path,
        "POST",
        {
          teamId: team.id,
          title: "Interrupted work",
        },
        f.cookie,
        { DB: interrupted.db },
      );
      expect(refused.status, await refused.clone().text()).toBe(400);
      expect(await refused.json()).toMatchObject({
        error: "invalid_request",
        message: expect.stringContaining("selected option became unavailable"),
      });
      expect(interrupted.fired()).toBe(true);
      expect(await creationCounts(team.id)).toEqual(before);
      expect(await sequence(team.id)).toBeNull();
      expect(await prefixSequence(oldPrefix)).toBe(1);
      expect((await f.call("/issues/" + oldPrefix + "-1")).status).toBe(404);
      expect(
        (await f.state()).teams.find((t) => t.id === team.id)!.prefixEditable,
      ).toBe(true);
      const retried = await f.call("/" + path, "POST", {
        teamId: team.id,
        title: "Retried work",
      });
      expect(retried.status, await retried.clone().text()).toBe(201);
      expect(
        ((await retried.json()) as { identifier: string }).identifier,
      ).toBe(newPrefix + "-1");
      expect(
        await env.DB.prepare(
          "SELECT identifier,origin_prefix,sequence_number FROM issues WHERE team_id=?",
        )
          .bind(team.id)
          .first(),
      ).toEqual({
        identifier: newPrefix + "-1",
        origin_prefix: newPrefix,
        sequence_number: 1,
      });
      expect(await sequence(team.id)).toBe(1);
      expect(await prefixSequence(newPrefix)).toBe(1);
      expect(await creationCounts(team.id)).toEqual({
        issues: 1,
        evidence: path === "intake" ? 1 : 0,
        activity: 1,
        history: 1,
      });
      expect(
        (
          await f.call("/settings/teams/" + team.id, "PATCH", {
            identifierPrefix: "LATER",
          })
        ).status,
      ).toBe(409);
    },
  );
}

for (const reuse of ["same team", "new team"] as const) {
  check(
    "TEAM-001 ISSUE-002",
    `released prefixes retain every allocation when reclaimed by the ${reuse}`,
    async () => {
      const f = fixture;
      const oldPrefix = reuse === "same team" ? "AB" : "GH";
      const newPrefix = reuse === "same team" ? "CD" : "IJ";
      const original = (
        await f.mutate("/settings/teams", "POST", {
          name: "Original prefix owner " + reuse,
          identifierPrefix: oldPrefix,
        })
      ).teams.find((t) => t.identifierPrefix === oldPrefix)!;
      const reserve = (teamId: string) =>
        allocateIssueSequence(
          env.DB,
          f.owner,
          f.initial.workspace.id,
          teamId,
          new Date().toISOString(),
        );
      expect(await reserve(original.id)).toEqual({
        prefix: oldPrefix,
        sequence: 1,
      });
      await f.mutate("/settings/teams/" + original.id, "PATCH", {
        identifierPrefix: newPrefix,
      });
      expect(await sequence(original.id)).toBeNull();
      expect(await reserve(original.id)).toEqual({
        prefix: newPrefix,
        sequence: 1,
      });
      expect(await prefixSequence(oldPrefix)).toBe(1);
      let target = original;
      if (reuse === "same team") {
        target = (
          await f.mutate("/settings/teams/" + original.id, "PATCH", {
            identifierPrefix: oldPrefix,
          })
        ).teams.find((t) => t.id === original.id)!;
      } else {
        target = (
          await f.mutate("/settings/teams", "POST", {
            name: "New prefix owner",
            identifierPrefix: oldPrefix,
          })
        ).teams.find((t) => t.identifierPrefix === oldPrefix)!;
      }
      expect(target.prefixEditable).toBe(true);
      expect(await sequence(target.id)).toBe(1);
      const created = await f.create({ teamId: target.id });
      expect(created.identifier).toBe(oldPrefix + "-2");
      expect(await sequence(target.id)).toBe(2);
      expect(await prefixSequence(oldPrefix)).toBe(2);
      expect(await prefixSequence(newPrefix)).toBe(1);
      expect((await f.call("/issues/" + oldPrefix + "-1")).status).toBe(404);
    },
  );
}

check(
  "TEAM-001 TEAM-003 ISSUE-002 ISSUE-012",
  "actual incoming membership freezes a never-allocating team's prefix after moving away and deletion while name and archive stay editable",
  async () => {
    const f = fixture;
    const origin = f.initial.teams[0];
    const target = (
      await f.mutate("/settings/teams", "POST", {
        name: "Incoming only",
        identifierPrefix: "INCOMING",
      })
    ).teams.find((t) => t.identifierPrefix === "INCOMING")!;
    const issue = await f.create();
    const move = (team: typeof target, expectedVersion: number) =>
      f.call("/issues/" + issue.identifier + "/team", "POST", {
        teamId: team.id,
        statusId: team.statuses.find((s) => s.category === "backlog")!.id,
        expectedVersion,
      });
    expect((await move(target, 1)).status).toBe(200);
    expect((await move(origin, 2)).status).toBe(200);
    expect(await sequence(target.id)).toBeNull();
    expect(
      await env.DB.prepare("SELECT id FROM issues WHERE team_id=?")
        .bind(target.id)
        .first(),
    ).toBeNull();
    expect(
      (await f.state()).teams.find((t) => t.id === target.id)!.prefixEditable,
    ).toBe(false);
    expect(
      (
        await f.call("/settings/teams/" + target.id, "PATCH", {
          identifierPrefix: "CHANGED",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        (await (await f.call("/issues/" + issue.identifier)).json()) as {
          identifier: string;
        }
      ).identifier,
    ).toBe(issue.identifier);
    await env.DB.prepare("DELETE FROM issues WHERE id=?").bind(issue.id).run();
    for (const team of [origin, target]) {
      expect(
        await env.DB.prepare(
          "SELECT first_issue_at FROM team_issue_history WHERE team_id=?",
        )
          .bind(team.id)
          .first(),
      ).toEqual({ first_issue_at: expect.any(String) });
      expect(
        (
          await f.call("/settings/teams/" + team.id, "PATCH", {
            identifierPrefix: "REPLACED",
          })
        ).status,
      ).toBe(409);
      const renamed = (
        await f.mutate("/settings/teams/" + team.id, "PATCH", {
          name: team.name + " renamed",
          archived: true,
        })
      ).teams.find((t) => t.id === team.id)!;
      expect(renamed).toMatchObject({
        identifierPrefix: team.identifierPrefix,
        prefixEditable: false,
        name: team.name + " renamed",
        archivedAt: expect.any(String),
      });
      expect(
        (
          await f.mutate("/settings/teams/" + team.id, "PATCH", {
            archived: false,
          })
        ).teams.find((t) => t.id === team.id)!.archivedAt,
      ).toBeNull();
    }
  },
);
