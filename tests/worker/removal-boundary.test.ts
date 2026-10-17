import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, expect, inject, it } from "vitest";
import { bindings, fixture, retainedData } from "./removal-fixture";
import { testSessionHash as digest, testSessionFence } from "./native-fixture";
import { createIssueInputSchema } from "../../src/core/features/issues/input";
import { createIssueRecord } from "../../src/core/features/issues/repository";
import { updateIssueRecord } from "../../src/core/features/issue-edit/repository";
import { addComment } from "../../src/core/features/discussion/repository";
beforeAll(async () => applyD1Migrations(env.DB, inject("migrations")));

import { beforeCommit } from "./removal-interleaving";
it("[BASE-ACCESS-002 OPS-004] each native invalidation between comment validation and transaction denies the entire batch", async () => {
  for (const mode of ["remove", "signout", "expire"] as const) {
    {
      const f = await fixture();
      let before: unknown;
      const db = beforeCommit(
        (sql) => sql.includes("INSERT INTO issue_comments"),
        async () => {
          if (mode === "remove") expect((await f.remove()).status).toBe(200);
          else {
            const hash = await digest(f.memberCookie.split("=")[1]);
            await env.DB.prepare(
              mode === "signout"
                ? "UPDATE oa_sessions SET revoked_at=? WHERE token_hash=?"
                : "UPDATE oa_sessions SET expires_at=? WHERE token_hash=?",
            )
              .bind(Date.parse("2020-01-01T00:00:00.000Z"), hash)
              .run();
          }
          before = await retainedData();
        },
      );
      const response = await f.request(
        "/issues/" + f.issue.identifier + "/comments",
        "POST",
        { body: "Commit race" },
        f.memberCookie,
        { ...bindings, DB: db },
      );
      expect(before).toBeDefined();
      expect(response.status).toBe(401);
      expect(await retainedData()).toEqual(before);
    }
  }
}, 20000);
it("[OPS-004] every native mutation fences removed actors while active peers remain able to write", async () => {
  for (const kind of [
    "create",
    "intake",
    "edit",
    "comment",
    "comment-edit",
    "comment-delete",
    "link",
    "link-delete",
    "accept",
    "defer",
    "decline",
    "return",
    "timezone",
  ] as const) {
    {
      const f = await fixture();
      let path = "/issues/" + f.issue.identifier,
        method = "PATCH",
        body: unknown = { expectedVersion: 1, title: "A late edit" };
      if (kind === "create") {
        path = "/issues";
        method = "POST";
        body = { title: "Late issue", teamId: f.team };
      }
      if (kind === "intake") {
        path = "/intake";
        method = "POST";
        body = { title: "Late intake", teamId: f.team };
      }
      if (kind.startsWith("comment")) {
        path += "/comments";
        method = "POST";
        body = { body: "A late comment" };
        if (kind !== "comment") {
          // Only a comment's author edits it (ISSUE-008), so the member changes their own.
          const c = await f.request(path, method, body, f.memberCookie);
          const id = ((await c.json()) as any).id;
          path += "/" + id;
          method = kind === "comment-delete" ? "DELETE" : "PATCH";
          body = method === "DELETE" ? undefined : { body: "Late replacement" };
        }
      }
      if (kind.startsWith("link")) {
        path += "/links";
        method = "POST";
        body = {
          name: "Retained source",
          url: "https://example.test/evidence",
        };
        if (kind === "link-delete") {
          const c = await f.request(path, method, body);
          const id = ((await c.json()) as any).id;
          path += "/" + id;
          method = "DELETE";
          body = undefined;
        }
      }
      if (["accept", "defer", "decline", "return"].includes(kind)) {
        const intake = await f.request("/intake", "POST", {
          title: "Triage",
          teamId: f.team,
        });
        const issue = (await intake.json()) as any;
        path = "/issues/" + issue.identifier + "/" + kind;
        method = "POST";
        body = { expectedVersion: 1 };
        if (kind === "defer")
          body = {
            expectedVersion: 1,
            reason: "Needs evidence",
            returnAt: new Date(Date.now() + 86400000).toISOString(),
          };
        if (kind === "decline")
          body = { expectedVersion: 1, reason: "Not actionable" };
        if (kind === "return") {
          expect(
            (
              await f.request(
                "/issues/" + issue.identifier + "/defer",
                "POST",
                {
                  expectedVersion: 1,
                  reason: "Wait",
                  returnAt: new Date(Date.now() + 86400000).toISOString(),
                },
              )
            ).status,
          ).toBe(200);
          body = { expectedVersion: 2 };
        }
      }
      if (kind === "timezone") {
        path = "/settings";
        method = "PATCH";
        body = { timezone: "Europe/Paris" };
      }
      let before: unknown;
      const db = beforeCommit(
        (sql) => /\b(?:INSERT INTO|UPDATE|DELETE FROM)\b/i.test(sql),
        async () => {
          // Admission/rate writes precede the scoped transaction. Only a guarded batch
          // comes through here; the one-shot event happens after all earlier reads.
          expect((await f.remove()).status).toBe(200);
          before = await retainedData();
        },
      );
      const response = await f.request(path, method, body, f.memberCookie, {
        ...bindings,
        DB: db,
      });
      expect(before).toBeDefined();
      expect(response.status).toBe(401);
      expect(await retainedData()).toEqual(before);
      expect(
        (
          await f.request(
            "/issues/" + f.issue.identifier + "/comments",
            "POST",
            {
              body: "Active operator still works",
            },
          )
        ).status,
      ).toBe(201);
    }
  }
}, 20000);
it("[ISSUE-007 OPS-004] a late failing statement rolls back comment and activity together", async () => {
  const f = await fixture();
  const before = await retainedData();
  const db = new Proxy(env.DB, {
    get(target, key) {
      if (key === "batch")
        return (items: D1PreparedStatement[]) =>
          target.batch(
            items.length > 2
              ? [
                  ...items,
                  target.prepare(
                    "INSERT INTO absent_mutation_test_table VALUES (1)",
                  ),
                ]
              : items,
          );
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await expect(
    addComment(db, f.issue.id, f.member, "Rollback"),
  ).rejects.toThrow();
  expect(await retainedData()).toEqual(before);
}, 20000);

it("[OPS-004 OPS-001] simultaneous active native commands retain their own actors and both commit", async () => {
  const f = await fixture(),
    path = "/issues/" + f.issue.identifier + "/comments";
  const responses = await Promise.all([
    f.request(
      path,
      "POST",
      { body: "Owner concurrent command" },
      f.ownerCookie,
    ),
    f.request(
      path,
      "POST",
      { body: "Member concurrent command" },
      f.memberCookie,
    ),
  ]);
  expect(responses.map((response) => response.status)).toEqual([201, 201]);
  const comments = (
    await env.DB.prepare(
      "SELECT body,actor_operator_id FROM issue_comments WHERE issue_id=? ORDER BY body",
    )
      .bind(f.issue.id)
      .all()
  ).results;
  expect(comments).toEqual([
    { body: "Member concurrent command", actor_operator_id: f.member },
    { body: "Owner concurrent command", actor_operator_id: f.owner },
  ]);
  expect((await f.remove()).status).toBe(200);
  expect(
    (await env.DB.prepare(
      "SELECT count(*) AS n FROM issue_activity WHERE actor_operator_id=?",
    )
      .bind(f.member)
      .first())!.n,
  ).toBe(0);
}, 20000);
