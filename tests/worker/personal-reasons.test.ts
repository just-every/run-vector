import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import assert from "node:assert/strict";
import { beforeAll, inject, it } from "vitest";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { createIssueInputSchema } from "../../src/core/features/issues/input";
import { createIssueRecord } from "../../src/core/features/issues/repository";
import type {
  getCurrentStream,
  getMyWorkStream,
} from "../../src/core/features/streams/service";

import { createServerApp } from "../../src/core/app/server";
import { testCookie } from "./native-fixture";

const now = new Date("2026-09-30T12:00:00.000Z");
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, now);
});
async function issue(extra: Record<string, unknown> = {}) {
  const created = await createIssueRecord(env.DB, {
    actorOperatorId: ids.sarah,
    now,
    input: createIssueInputSchema.parse({
      title: "Explainable personal reason",
      teamId: ids.flow,
      assigneeOperatorId: ids.sarah,
      ...extra,
    }),
  });
  const row = await env.DB.prepare("SELECT id FROM issues WHERE identifier=?")
    .bind(created.identifier)
    .first<{ id: string }>();
  assert.ok(row);
  return { ...created, id: row.id };
}

it("[WORK-001][WORK-002][CURRENT-006] persisted assigned and blocked issues carry truthful primary reasons without inventing cycle commitments or changing Current membership", async () => {
  const backlog = await issue(),
    unstarted = await issue({ statusId: ids.flowUnstarted });
  const committed = await issue({
    statusId: ids.flowUnstarted,
    cycleId: ids.flowCycle,
  });
  const due = await issue({
    statusId: ids.flowUnstarted,
    dueDate: "2026-10-01",
  });
  const started = await issue({ statusId: ids.flowStarted });
  const blocked = await issue({
    statusId: ids.flowStarted,
    dueDate: "2026-09-29",
  });
  await env.DB.prepare(
    "INSERT INTO issue_dependencies(blocked_issue_id,blocking_issue_id,created_at) VALUES(?,?,?)",
  )
    .bind(blocked.id, backlog.id, now.toISOString())
    .run();
  const read = async (path: string) => {
    const response = await createServerApp().request(
      "https://vector.test/api/" + path + "?at=" + now.toISOString(),
      { headers: { cookie: await testCookie(env.DB, ids.sarah) } },
      { ...env, APP_ORIGIN: "https://vector.test" },
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const work = (await read("my-work")) as Awaited<
    ReturnType<typeof getMyWorkStream>
  >;
  const find = (section: "waiting" | "now" | "next", identifier: string) => {
    const entry = work.sections[section].find(
      (item) => item.identifier === identifier,
    );
    assert.ok(entry, `${identifier} belongs in ${section}`);
    assert.equal(
      Object.values(work.sections)
        .flat()
        .filter((item) => item.identifier === identifier).length,
      1,
    );
    return entry;
  };
  assert.equal(
    find("next", backlog.identifier).primaryReason,
    "assigned-to-you",
  );
  assert.equal(
    find("next", unstarted.identifier).primaryReason,
    "assigned-to-you",
  );
  assert.equal(
    find("next", committed.identifier).primaryReason,
    "cycle-commitment",
  );
  assert.equal(
    find("next", due.identifier).primaryReason,
    "due-within-seven-days",
  );
  assert.equal(find("now", started.identifier).primaryReason, "started-work");
  const waiting = find("waiting", blocked.identifier);
  assert.equal(waiting.primaryReason, "unresolved-dependency");
  assert.equal(waiting.contextReasons.includes("unresolved-dependency"), false);
  const current = (await read("current")) as Awaited<
    ReturnType<typeof getCurrentStream>
  >;
  assert.ok(
    current.sections.now.some(
      (item) =>
        item.identifier === blocked.identifier &&
        item.primaryReason === "overdue" &&
        item.contextReasons.includes("unresolved-dependency"),
    ),
  );
  for (const fixture of [backlog, unstarted])
    assert.equal(
      Object.values(current.sections)
        .flat()
        .some((item) => item.identifier === fixture.identifier),
      false,
    );
});
