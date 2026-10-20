import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import type { SubissuesData } from "../../src/core/features/subissues/schema";
import { collaborationFixture } from "./collaboration-fixture";
import { bindings, origin, request } from "./base-auth-fixture";
import { heldBody } from "./removal-fixture";
import { createServerApp } from "../../src/core/app/server";
import { receipt } from "./subissues-fixture";
contractWith(
  it,
  "ISSUE-019 REL-006 BASE-ACCESS-004 BASE-INPUT-001",
  "hierarchy edits reject stale membership, cycles and revoked sessions without partial children or automation",
  async () => {
    const f = await collaborationFixture(),
      parent = await f.create(),
      path = `/issues/${parent.identifier}/subissues`;
    let state = await receipt<SubissuesData>(await f.call(path));
    expect((await request("/api" + path)).status).toBe(401);
    expect(
      (
        await f.call(path, "POST", {
          expectedVersion: state.version,
          title: "  ",
        })
      ).status,
    ).toBe(400);
    state = await receipt<SubissuesData>(
      await f.call(path, "POST", {
        expectedVersion: state.version,
        title: "Child",
      }),
      201,
    );
    expect(
      (
        await f.call(path, "POST", {
          expectedVersion: parent.version,
          title: "Stale child",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await f.call(path, "PATCH", {
          expectedVersion: state.version,
          identifiers: [],
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await f.call(path, "PATCH", {
          expectedVersion: state.version,
          identifiers: [
            state.children[0].identifier,
            state.children[0].identifier,
          ],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call(`/issues/${parent.identifier}/parent`, "PATCH", {
          expectedVersion: state.version,
          parentIdentifier: state.children[0].identifier,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call(`/issues/${parent.identifier}/parent`, "PATCH", {
          expectedVersion: state.version,
          parentIdentifier: parent.identifier,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call(
          "/teams/00000000000000000000000000/subissue-rule",
          "PATCH",
          { expectedVersion: 0, enabled: true },
        )
      ).status,
    ).toBe(404);
    const held = heldBody(),
      app = createServerApp();
    const pending = app.request(
      origin + "/api" + path,
      {
        method: "POST",
        headers: {
          host: new URL(origin).host,
          Origin: origin,
          cookie: f.cookie,
          "content-type": "application/json",
          "CF-Connecting-IP": "192.0.2.18",
        },
        body: held.body,
      },
      bindings,
    );
    await held.reading;
    expect((await request("/auth/signout", "POST", {}, f.cookie)).status).toBe(
      204,
    );
    held.release(
      JSON.stringify({
        expectedVersion: state.version,
        title: "Revoked child",
      }),
    );
    expect((await pending).status).toBe(401);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM issue_parents WHERE parent_issue_id=?",
      )
        .bind(parent.id)
        .first<number>("n"),
    ).toBe(1);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM issues WHERE title IN('Stale child','Revoked child')",
      ).first<number>("n"),
    ).toBe(0);
  },
);