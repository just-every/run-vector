import { createApiApp } from "../../src/core/app/api";
import { bindings, origin } from "./base-auth-fixture";
import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { mentionToken } from "../../src/core/features/notifications/mention-token";
import { removeOperator } from "../../src/core/features/settings/removal";
contractWith(
  it,
  "ISSUE-013 NOTIFY-002 NOTIFY-003 BASE-ACCESS-004",
  "selected identities are workspace-bound, unknown and removed tokens remain literal, and rename edits do not notify or reverse explicit unfollow",
  async () => {
    const f = await collaborationFixture();
    const native = createApiApp();
    const call = (
      path: string,
      method = "GET",
      body?: unknown,
      cookie = f.cookie,
    ) =>
      native.request(
        origin + path,
        {
          method,
          headers: {
            host: new URL(origin).host,
            origin,
            cookie,
            "content-type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        bindings,
      );
    const data = async (path: string, cookie = f.cookie) => {
      const r = await call(path, "GET", undefined, cookie);
      expect(r.status, await r.clone().text()).toBe(200);
      return r.json() as Promise<any>;
    };
    const workspace = "01J00000000000000000000991",
      foreign = "01J00000000000000000000992";
    await env.DB.prepare(
      "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,'Foreign','UTC','now','now')",
    )
      .bind(workspace)
      .run();
    await env.DB.prepare(
      "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,'Foreign','foreign@mentions.test','2026-10-01','2026-10-01')",
    )
      .bind(foreign, workspace)
      .run();
    await removeOperator(env.DB, f.owner, f.cara);
    const literal = [
      mentionToken({ id: f.cara, name: "Removed" }),
      mentionToken({ id: foreign, name: "Foreign" }),
      mentionToken({ id: "01J00000000000000000000993", name: "Unknown" }),
    ].join(" ");
    const created = await call("/issues", "POST", {
      title: "Mention scope",
      teamId: f.initial.teams[0].id,
      description: literal,
    });
    expect(created.status, await created.clone().text()).toBe(201);
    const issue = (await created.json()) as { identifier: string };
    expect((await data(`/issues/${issue.identifier}`)).description).toBe(
      literal,
    );
    expect(await count("issue_mentions")).toBe(0);
    expect(await count("notifications")).toBe(0);
    const token = mentionToken({ id: f.bob, name: "Bob" });
    expect(
      (
        await call(`/issues/${issue.identifier}`, "PATCH", {
          expectedVersion: 1,
          description: token,
        })
      ).status,
    ).toBe(200);
    expect(await count("notifications")).toBe(1);
    await call(
      `/issues/${issue.identifier}/subscription`,
      "PATCH",
      { following: false },
      f.bobCookie,
    );
    expect(
      (
        await call(`/issues/${issue.identifier}`, "PATCH", {
          expectedVersion: 2,
          description: mentionToken({ id: f.bob, name: "Renamed Bob" }),
        })
      ).status,
    ).toBe(200);
    expect(await count("notifications")).toBe(1);
    expect(
      (await data(`/issues/${issue.identifier}/subscription`, f.bobCookie))
        .following,
    ).toBe(false);
  },
);
