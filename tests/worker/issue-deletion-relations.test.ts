import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { setup, create, call, ids } from "./bulk-parent-fixture";
import { deleteRequest } from "./issue-deletion-request";
import { beforeCommit } from "./removal-interleaving";
beforeAll(setup);
const mark = (issue: any, canonical: any, DB = env.DB) =>
  call(
    `/issues/${issue.identifier}/duplicate`,
    {
      expectedVersion: issue.version,
      canonicalIdentifier: canonical?.identifier ?? null,
    },
    "POST",
    DB,
  );
it("[REL-003 REL-004 REL-005 ISSUE-010 ISSUE-002] public duplicate decisions repoint atomically, retain content and history, undo status and protect canonical deletion", async () => {
  const canonical = await create(),
    next = await create(),
    duplicate = await create({
      description: "Preserved duplicate description",
    });
  expect(
    (
      await call(`/issues/${duplicate.identifier}/comments`, {
        body: "Preserved duplicate discussion",
      })
    ).status,
  ).toBe(201);
  const discussionBefore = await (
    await call(`/issues/${duplicate.identifier}/discussion`)
  ).json();
  expect((await mark(duplicate, duplicate)).status).toBe(409);
  const first = await mark(duplicate, canonical);
  expect(first.status, await first.clone().text()).toBe(200);
  const marked = (await first.json()) as any;
  expect(marked.status.category).toBe("duplicate");
  expect(marked.description).toBe(duplicate.description);
  expect((await mark(next, marked)).status).toBe(409);
  const refused = await deleteRequest(canonical.identifier, canonical.version);
  expect(refused.status).toBe(409);
  expect(((await refused.json()) as any).message).toContain(
    duplicate.identifier,
  );
  const repoint = await mark(canonical, next);
  expect(repoint.status, await repoint.clone().text()).toBe(200);
  const refreshed = (await (
    await call(`/issues/${duplicate.identifier}`)
  ).json()) as any;
  expect(refreshed.canonical.identifier).toBe(next.identifier);
  expect(refreshed.version).toBe(marked.version + 1);
  const nextDetail = (await (
    await call(`/issues/${next.identifier}`)
  ).json()) as any;
  expect(nextDetail.duplicates.map((d: any) => d.identifier).sort()).toEqual(
    [canonical.identifier, duplicate.identifier].sort(),
  );
  expect((await mark(next, canonical)).status).toBe(409);
  const undone = await mark(refreshed, null);
  expect(undone.status, await undone.clone().text()).toBe(200);
  const restored = (await undone.json()) as any;
  expect(restored.status.id).toBe(duplicate.status.id);
  expect(restored.canonical).toBeNull();
  expect(
    await (await call(`/issues/${duplicate.identifier}/discussion`)).json(),
  ).toEqual(discussionBefore);
  expect(
    restored.activity.filter((a: any) => a.kind === "issue.duplicate_changed"),
  ).toHaveLength(3);
  const canonicalNow = (await (
    await call(`/issues/${canonical.identifier}`)
  ).json()) as any;
  expect(
    (await deleteRequest(canonical.identifier, canonicalNow.version)).status,
  ).toBe(200);
  expect(
    ((await (await call(`/issues/${next.identifier}`)).json()) as any)
      .duplicates,
  ).toEqual([]);
  const statuses = (
    await env.DB.prepare(
      "SELECT id,category FROM workflow_statuses WHERE team_id=?",
    )
      .bind(ids.flow)
      .all<{ id: string; category: string }>()
  ).results;
  const status = (category: string) =>
    statuses.find((row) => row.category === category)!.id;
  const prior = await create({ statusId: status("started") });
  const completed = await call(
    `/issues/${prior.identifier}`,
    { expectedVersion: prior.version, statusId: status("completed") },
    "PATCH",
  );
  expect(completed.status).toBe(200);
  const terminal = (await completed.json()) as any;
  const decided = await mark(terminal, next);
  expect(decided.status).toBe(200);
  const undo = await mark(await decided.json(), null);
  expect(undo.status).toBe(200);
  expect(((await undo.json()) as any).status.id).toBe(status("started"));
  const withoutPrior = await create({ statusId: status("completed") });
  const noPriorDecision = await mark(withoutPrior, next);
  expect(noPriorDecision.status).toBe(200);
  const noPriorUndo = await mark(await noPriorDecision.json(), null);
  expect(noPriorUndo.status).toBe(200);
  expect(((await noPriorUndo.json()) as any).status.id).toBe(status("backlog"));
  const lastSequence = await env.DB.prepare(
    "SELECT MAX(sequence_number) n FROM issues WHERE origin_prefix=?",
  )
    .bind(canonical.identifier.split("-")[0])
    .first<number>("n");
  const last = await create();
  expect(Number(last.identifier.split("-")[1])).toBeGreaterThan(lastSequence!);
  expect(
    (await call("/settings/teams/" + ids.flow, { archived: true }, "PATCH"))
      .status,
  ).toBe(200);
  expect(
    (await deleteRequest(last.identifier, last.version, { actor: ids.maya }))
      .status,
  ).toBe(200);
  expect(
    (await call("/settings/teams/" + ids.flow, { archived: false }, "PATCH"))
      .status,
  ).toBe(200);
  const afterHighestDeletion = await create();
  expect(Number(afterHighestDeletion.identifier.split("-")[1])).toBeGreaterThan(
    Number(last.identifier.split("-")[1]),
  );
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
});
it("[ISSUE-010 REL-003 ISSUE-006] a new canonical duplicate and new attachment reservation cannot evade final deletion admission", async () => {
  const canonical = await create(),
    duplicate = await create();
  const DB = beforeCommit(
    (sql) => sql.includes("DELETE FROM issues"),
    async () => {
      expect((await mark(duplicate, canonical)).status).toBe(200);
    },
  );
  expect(
    (await deleteRequest(canonical.identifier, canonical.version, { DB }))
      .status,
  ).toBe(409);
  expect(
    await env.DB.prepare("SELECT 1 FROM issue_deletions WHERE issue_id=?")
      .bind(canonical.id)
      .first(),
  ).toBeNull();
  const after = await create();
  const raced = beforeCommit(
    (sql) => sql.includes("DELETE FROM issues"),
    async () => {
      await env.DB.prepare(
        "INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,writer_settled,created_at,updated_at) VALUES('deletion-raced-file',?,?,'Late','text/plain',4,'deletion-raced-file','pending',0,'now','now')",
      )
        .bind(after.id, ids.sarah)
        .run();
    },
  );
  const response = await deleteRequest(after.identifier, after.version, {
    DB: raced,
  });
  expect(response.status, await response.clone().text()).toBe(409);
  expect(
    await env.DB.prepare("SELECT 1 FROM issue_files WHERE issue_id=?")
      .bind(after.id)
      .first(),
  ).not.toBeNull();
  expect(
    await env.DB.prepare("SELECT 1 FROM issue_deletions WHERE issue_id=?")
      .bind(after.id)
      .first(),
  ).toBeNull();
  const retry = await deleteRequest(after.identifier, after.version);
  expect(retry.status).toBe(202);
  expect(await retry.json()).toMatchObject({ cleanup: "pending", files: 1 });
  expect((await mark(await create(), after)).status).toBe(404);
});
