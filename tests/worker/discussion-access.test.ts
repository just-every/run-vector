import { env } from "cloudflare:workers";
import { afterEach, expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture } from "./collaboration-fixture";
import { bindings, origin, request } from "./base-auth-fixture";
import { heldBody, retainedData } from "./removal-fixture";
import { createServerApp } from "../../src/core/app/server";
import { createApiApp } from "../../src/core/app/api";
import {
  addComment,
  changeComment,
} from "../../src/core/features/discussion/repository";
import { MutationAccessError } from "../../src/core/features/auth/mutation-database";
import { mentionToken } from "../../src/core/features/notifications/mention-token";

afterEach(async () => {
  // Each independent race signs in the same fixture owner afresh.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM access_rate_limits"),
    env.DB.prepare("DELETE FROM oa_limits"),
  ]);
});

async function discussionState() {
  const state = await retainedData();
  for (const table of [
    "issue_followers",
    "issue_mentions",
    "notifications",
    "notification_candidates",
    "notification_events",
    "notification_deliveries",
    "notification_delivery_attempts",
    "rer_mail_development_outbox",
    "notification_mail_audit",
  ])
    state[table] = (
      await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()
    ).results;
  return state;
}

contractWith(
  it,
  "OPS-004 BASE-ACCESS-004 ISSUE-008",
  "direct comment creation, editing and deletion retain the mutation denial contract after removal",
  async () => {
    const f = await collaborationFixture(),
      issue = await f.create(),
      id = await addComment(env.DB, issue.id, f.owner, "Retained comment");
    const comment = await f.any(f.bobCookie, `/issues/${issue.identifier}/comments`, "POST", { body: "A teammate contribution" });
    expect(comment.status).toBe(201);
    const commentId = (await comment.json() as { id: string }).id;
    const app = createServerApp();
    const filePath = `/api/issues/${issue.identifier}/files`;
    const fileName = "synthetic-vector-duplicates.csv";
    const upload = await app.request(origin + filePath, { method: "POST", headers: {
      origin, host: new URL(origin).host, cookie: f.cookie, "content-type": "text/csv", "x-file-name": fileName,
    }, body: "order,duplicate\n1,2" }, bindings);
    expect(upload.status, await upload.clone().text()).toBe(201);
    const file = await upload.json() as { id: string };
    const privateLink = filePath + "/" + file.id;
    const document = await app.request(origin + privateLink, { headers: { host: new URL(origin).host, accept: "text/html" } }, bindings);
    expect(document.status).toBe(302);
    expect(document.headers.get("location")).toBe("/signin?returnTo=" + encodeURIComponent(privateLink));
    const client = await app.request(origin + privateLink, { headers: { host: new URL(origin).host, accept: "application/json" } }, bindings);
    expect(client.status).toBe(401);
    expect(await client.json()).toMatchObject({ error: "unauthenticated" });
    expect(
      (await f.call(`/settings/operators/${f.bob}`, "DELETE")).status,
    ).toBe(200);
    const detail = await f.data(f.cookie, `/issues/${issue.identifier}`);
    const discussion = await f.data(f.cookie, `/issues/${issue.identifier}/discussion`);
    const removedComment = discussion.comments.find((item: { id: string }) => item.id === commentId);
    const commentActivity = detail.activity.find((item: { kind: string; nextValue: { id?: string } }) => item.kind === "comment.created" && item.nextValue?.id === commentId);
    expect(commentActivity.actor).toBe(removedComment.actor);
    expect(commentActivity.actor).not.toBeNull();
    expect(detail.activity.find((item: { kind: string; nextValue: { id?: string } }) => item.kind === "file.created" && item.nextValue?.id === file.id).nextValue.name).toBe(fileName);
    const before = await discussionState();
    for (const mutate of [
      () => addComment(env.DB, issue.id, f.bob, "Rejected comment"),
      () => changeComment(env.DB, issue, id, f.bob, "Rejected edit"),
      () => changeComment(env.DB, issue, id, f.bob, null),
    ]) {
      await expect(mutate()).rejects.toThrow(MutationAccessError);
      expect(await discussionState()).toEqual(before);
    }
  },
);

for (const method of ["POST", "PATCH"] as const)
  contractWith(
    it,
    "OPS-004 BASE-ACCESS-002 BASE-ACCESS-004 ISSUE-008 NOTIFY-001 NOTIFY-002 NOTIFY-006",
    `native invalidation while a ${method} comment body is delayed denies every source and collaboration write`,
    async () => {
      for (const mode of ["remove", "signout", "expire"] as const) {
        try {
          const f = await collaborationFixture(),
            issue = await f.create({ title: "Private discussion title" }),
            // Bob edits his own comment: another's is refused before its body is read.
            id = await addComment(env.DB, issue.id, method === "PATCH" ? f.bob : f.owner, "Private comment"),
            held = heldBody();
          const path = `/issues/${issue.identifier}/comments${method === "PATCH" ? `/${id}` : ""}`;
          const pending = createApiApp().request(
            origin + path,
            {
              method,
              headers: {
                origin,
                host: new URL(origin).host,
                cookie: f.bobCookie,
                "content-type": "application/json",
              },
              body: held.body,
            },
            bindings,
          );
          await held.reading;
          if (mode === "remove")
            expect(
              (await f.call(`/settings/operators/${f.bob}`, "DELETE")).status,
            ).toBe(200);
          else if (mode === "signout")
            expect(
              (await request("/auth/signout", "POST", {}, f.bobCookie)).status,
            ).toBe(204);
          else
            await env.DB.prepare(
              "UPDATE oa_sessions SET expires_at=? WHERE operator_id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)",
            )
              .bind(Date.now() - 1000, f.bob)
              .run();
          const before = await discussionState();
          held.release(
            JSON.stringify({
              body: `Rejected private text ${mentionToken({ id: f.cara, name: "Cara" })}`,
            }),
          );
          const response = await pending;
          expect(response.status).toBe(401);
          // Before statement preparation the common mutation handler includes its
          // sign-in message; post-batch reauthorization uses the plain denial.
          expect(await response.json()).toEqual(
            mode === "remove"
              ? {
                  error: "unauthenticated",
                  message: "Sign in again to continue.",
                }
              : { error: "unauthenticated" },
          );
          expect(await discussionState()).toEqual(before);
          expect(
            (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
          ).toEqual([]);
          expect(
            (
              await f.call(`/issues/${issue.identifier}/comments`, "POST", {
                body: "Active operator still works",
              })
            ).status,
          ).toBe(201);
        } finally {
          await env.DB.batch([
            env.DB.prepare("DELETE FROM access_rate_limits"),
            env.DB.prepare("DELETE FROM oa_limits"),
          ]);
        }
      }
    },
  );

contractWith(
  it,
  "BASE-ACCESS-004 ISSUE-008 NOTIFY-001 NOTIFY-002 NOTIFY-006",
  "comment mutations from another workspace return a private not-found response without collaboration writes",
  async () => {
    const f = await collaborationFixture(),
      issue = await f.create({ title: "Other workspace private title" }),
      id = await addComment(env.DB, issue.id, f.owner, "Other private comment");
    const workspace = "01J00000000000000000000773";
    await env.DB.prepare(
      "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,'Other','UTC','now','now')",
    )
      .bind(workspace)
      .run();
    await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
      .bind(workspace, f.bob)
      .run();
    const before = await discussionState();
    const app = createApiApp();
    for (const method of ["POST", "PATCH", "DELETE"] as const) {
      const response = await app.request(
        origin +
          `/issues/${issue.identifier}/comments${method === "POST" ? "" : `/${id}`}`,
        {
          method,
          headers: {
            origin,
            host: new URL(origin).host,
            cookie: f.bobCookie,
            "content-type": "application/json",
          },
          body:
            method === "DELETE"
              ? undefined
              : JSON.stringify({ body: "Rejected cross-workspace text" }),
        },
        bindings,
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: "not_found",
        message: "Issue is unavailable.",
      });
      expect(await discussionState()).toEqual(before);
    }
  },
);
