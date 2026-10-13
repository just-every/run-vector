import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { setup, create, call } from "./bulk-parent-fixture";
import { deleteRequest } from "./issue-deletion-request";
import { beforeCommit } from "./removal-interleaving";
beforeAll(setup);
it("[ISSUE-010 REL-006 BASE-DATA-003] an incoming public child mutation invalidates prepared erasure and survives until a fresh deletion", async () => {
  const parent = await create(),
    child = await create();
  const DB = beforeCommit(
    (sql) => sql.includes("DELETE FROM issues"),
    async () => {
      const linked = await call(
        `/issues/${child.identifier}/parent`,
        { expectedVersion: child.version, parentIdentifier: parent.identifier },
        "PATCH",
      );
      expect(linked.status).toBe(200);
    },
  );
  const response = await deleteRequest(parent.identifier, parent.version, {
    DB,
  });
  console.info("deletion-incoming-child-status", response.status);
  expect(response.status, await response.clone().text()).toBe(409);
  expect(
    await env.DB.prepare(
      "SELECT parent_issue_id FROM issue_parents WHERE issue_id=?",
    )
      .bind(child.id)
      .first("parent_issue_id"),
  ).toBe(parent.id);
  expect((await call("/issues/" + parent.identifier)).status).toBe(200);
  expect(
    await env.DB.prepare("SELECT 1 FROM issue_deletions WHERE issue_id=?")
      .bind(parent.id)
      .first(),
  ).toBeNull();
  const retry = await deleteRequest(parent.identifier, parent.version);
  expect(retry.status, await retry.clone().text()).toBe(200);
  expect(
    await (await call("/issues/" + child.identifier)).json(),
  ).toMatchObject({ parent: null, version: child.version + 2 });
});
it("[ISSUE-010 NOTIFY-001 BASE-DATA-003] a public Inbox change participates in erasure while an unrelated issue edit does not", async () => {
  const { ids } = await import("./bulk-parent-fixture");
  const issue = await create({ assigneeOperatorId: ids.maya }),
    unrelated = await create();
  const notification = await env.DB.prepare(
    "SELECT id FROM notifications WHERE issue_id=? AND recipient_id=?",
  )
    .bind(issue.id, ids.maya)
    .first<{ id: string }>();
  expect(notification).not.toBeNull();
  const DB = beforeCommit(
    (sql) => sql.includes("DELETE FROM issues"),
    async () => {
      expect(
        (
          await call(
            "/notifications/" + notification!.id + "/read",
            {},
            "POST",
            env.DB,
            ids.maya,
          )
        ).status,
      ).toBe(200);
    },
  );
  expect(
    (await deleteRequest(issue.identifier, issue.version, { DB })).status,
  ).toBe(409);
  expect(
    await env.DB.prepare("SELECT read_at FROM notifications WHERE id=?")
      .bind(notification!.id)
      .first("read_at"),
  ).toBeTruthy();
  const unaffected = beforeCommit(
    (sql) => sql.includes("DELETE FROM issues"),
    async () => {
      expect(
        (
          await call(
            "/issues/" + unrelated.identifier,
            {
              expectedVersion: unrelated.version,
              title: "Concurrent independent edit",
            },
            "PATCH",
          )
        ).status,
      ).toBe(200);
    },
  );
  const response = await deleteRequest(issue.identifier, issue.version, {
    DB: unaffected,
  });
  expect(response.status, await response.clone().text()).toBe(200);
  expect(
    await (await call("/issues/" + unrelated.identifier)).json(),
  ).toMatchObject({
    title: "Concurrent independent edit",
    version: unrelated.version + 1,
  });
  expect(
    await env.DB.prepare("SELECT 1 FROM notifications WHERE id=?")
      .bind(notification!.id)
      .first(),
  ).toBeNull();
});
