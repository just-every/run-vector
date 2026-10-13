import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { returnDueIntake } from "../../src/core/features/intake-return/service";
contractWith(
  it,
  "NOTIFY-001 NOTIFY-003 ISSUE-006",
  "only the last blocker transition notifies the dependent assignee through status and edge producers",
  async () => {
    const f = await collaborationFixture(),
      blocked = await f.create({ assigneeOperatorId: f.bob }),
      a = await f.create(),
      b = await f.create();
    const get = (identifier: string) =>
      f.data(f.cookie, `/issues/${identifier}`);
    const edge = async (first: string, second: string, method: string) => {
      const i = await get(first),
        r = await get(second);
      const response = await f.call(`/issues/${first}/dependencies`, method, {
        expectedVersion: i.version,
        relatedVersion: r.version,
        relatedIdentifier: second,
        direction: "blocks",
      });
      expect(response.status, await response.clone().text()).toBe(200);
    };
    await edge(a.identifier, blocked.identifier, "POST");
    await edge(b.identifier, blocked.identifier, "POST");
    const statuses = f.initial.teams[0].statuses,
      done = statuses.find((s) => s.category === "completed")!,
      started = statuses.find((s) => s.category === "started")!;
    const state = async (identifier: string, statusId: string) => {
      const issue = await get(identifier);
      expect(
        (
          await f.call(`/issues/${identifier}`, "PATCH", {
            expectedVersion: issue.version,
            statusId,
          })
        ).status,
      ).toBe(200);
    };
    await state(a.identifier, done.id);
    expect(await count("notifications", "causes_json LIKE '%unblocked%'")).toBe(
      0,
    );
    await state(b.identifier, done.id);
    expect(await count("notifications", "causes_json LIKE '%unblocked%'")).toBe(
      1,
    );
    await state(b.identifier, done.id);
    expect(await count("notifications", "causes_json LIKE '%unblocked%'")).toBe(
      1,
    );
    await state(b.identifier, started.id);
    await edge(b.identifier, blocked.identifier, "DELETE");
    expect(await count("notifications", "causes_json LIKE '%unblocked%'")).toBe(
      2,
    );
    expect(await count("notification_deliveries")).toBe(1);
    const before = (await get(blocked.identifier)).version;
    await state(a.identifier, started.id);
    await state(a.identifier, done.id);
    expect((await get(blocked.identifier)).version).toBe(before);
    expect(await count("notifications", "causes_json LIKE '%unblocked%'")).toBe(
      3,
    );
  },
);
contractWith(
  it,
  "NOTIFY-001 NOTIFY-003",
  "return belongs to the exact latest deferral decision including equal deadlines, concurrent reads and cron",
  async () => {
    const f = await collaborationFixture();
    const response = await f.call("/intake", "POST", {
      title: "Deferred work",
      teamId: f.initial.teams[0].id,
    });
    expect(response.status).toBe(201);
    const initial = (await response.json()) as { identifier: string };
    const path = `/issues/${initial.identifier}`;
    let issue = await f.data(f.cookie, path);
    const deadline = new Date(Date.now() + 3600_000).toISOString();
    expect(
      (
        await f.any(f.bobCookie, path + "/defer", "POST", {
          expectedVersion: issue.version,
          returnAt: deadline,
        })
      ).status,
    ).toBe(200);
    issue = await f.data(f.cookie, path);
    expect(
      (
        await f.any(f.caraCookie, path + "/defer", "POST", {
          expectedVersion: issue.version,
          returnAt: deadline,
        })
      ).status,
    ).toBe(200);
    const origin = await env.DB.prepare(
      "SELECT d.actor_operator_id FROM issue_deferral_origins f JOIN intake_decisions d ON d.id=f.decision_id WHERE f.issue_id=?",
    )
      .bind(issue.id)
      .first<{ actor_operator_id: string }>();
    expect(origin!.actor_operator_id).toBe(f.cara);
    await f.data(
      f.cookie,
      "/current?at=" +
        encodeURIComponent(new Date(Date.now() + 7200_000).toISOString()),
    );
    expect(
      await count("notifications", "causes_json LIKE '%intake_return%'"),
    ).toBe(0);
    const now = new Date(Date.now() + 7200_000);
    await Promise.all([
      returnDueIntake({ DB: env.DB }, now),
      returnDueIntake({ DB: env.DB }, now),
    ]);
    await returnDueIntake({ DB: env.DB }, now);
    const rows = (
      await env.DB.prepare(
        "SELECT recipient_id FROM notifications WHERE causes_json LIKE '%intake_return%'",
      ).all<{ recipient_id: string }>()
    ).results;
    expect(rows).toEqual([{ recipient_id: f.cara }]);
    expect(await count("issue_deferral_origins")).toBe(0);
    expect(await count("notification_deliveries")).toBe(0);
  },
);
