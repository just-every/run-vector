import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { writeIntakeDecision } from "../../src/core/features/issues/repository";
import {
  endIntakeDeferral,
  returnDueIntake,
} from "../../src/core/features/intake-return/service";
import { removeOperator } from "../../src/core/features/settings/removal";
contractWith(
  it,
  "NOTIFY-001 NOTIFY-003 ISSUE-006",
  "equal-time deferrals retain exact decision identity; self-return and removed deferrer never notify another operator",
  async () => {
    const f = await collaborationFixture();
    async function intake() {
      const r = await f.call("/intake", "POST", {
        title: "Deferral identity",
        teamId: f.initial.teams[0].id,
      });
      expect(r.status).toBe(201);
      return r.json() as Promise<{
        id: string;
        identifier: string;
        version: number;
      }>;
    }
    const issue = await intake(),
      now = new Date(),
      deadline = new Date(now.getTime() + 3600_000).toISOString();
    for (const [actor, expectedVersion] of [
      [f.bob, 1],
      [f.cara, 2],
    ] as const)
      expect(
        (
          await writeIntakeDecision(env.DB, {
            actorOperatorId: actor,
            expectedVersion,
            identifier: issue.identifier,
            input: { expectedVersion, returnAt: deadline, reason: null },
            kind: "deferred",
            now,
          })
        ).outcome,
      ).toBe("written");
    const rows = (
      await env.DB.prepare(
        "SELECT id,actor_operator_id,created_at FROM intake_decisions WHERE issue_id=? AND kind='deferred'",
      )
        .bind(issue.id)
        .all<{ id: string; actor_operator_id: string; created_at: string }>()
    ).results;
    expect(rows).toHaveLength(2);
    expect(rows[0].created_at).toBe(rows[1].created_at);
    const stored = await env.DB.prepare(
      "SELECT decision_id FROM issue_deferral_origins WHERE issue_id=?",
    )
      .bind(issue.id)
      .first<string>("decision_id");
    expect(rows.find((r) => r.id === stored)!.actor_operator_id).toBe(f.cara);
    await endIntakeDeferral(env.DB, issue.identifier, f.cara, 3);
    expect(
      await count("notifications", "causes_json LIKE '%intake_return%'"),
    ).toBe(0);
    const removed = await intake();
    await writeIntakeDecision(env.DB, {
      actorOperatorId: f.bob,
      expectedVersion: 1,
      identifier: removed.identifier,
      input: { expectedVersion: 1, returnAt: deadline, reason: null },
      kind: "deferred",
      now,
    });
    await removeOperator(env.DB, f.owner, f.bob);
    await returnDueIntake({ DB: env.DB }, new Date(now.getTime() + 7200_000));
    expect(
      await count("notifications", "causes_json LIKE '%intake_return%'"),
    ).toBe(0);
    expect(await count("issue_deferral_origins")).toBe(0);
  },
);
