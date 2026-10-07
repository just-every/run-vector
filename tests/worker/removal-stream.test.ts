import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, expect, inject, it } from "vitest";
import {
  app,
  bindings,
  fixture,
  heldBody,
  origin,
  retainedData,
} from "./removal-fixture";
beforeAll(async () => applyD1Migrations(env.DB, inject("migrations")));
for (const kind of ["comment", "edit"] as const)
  it(`[OPS-004 BASE-ACCESS-002] denies body-delayed ${kind} after successful native removal without writes`, async () => {
    const f = await fixture(),
      held = heldBody();
    const path =
      "/issues/" + f.issue.identifier + (kind === "comment" ? "/comments" : "");
    const pending = app.request(
      origin + "/api" + path,
      {
        method: kind === "comment" ? "POST" : "PATCH",
        headers: {
          cookie: f.memberCookie,
          origin,
          "content-type": "application/json",
        },
        body: held.body,
      },
      bindings,
    );
    await held.reading;
    expect((await f.remove()).status).toBe(200);
    const before = await retainedData();
    held.release(
      JSON.stringify(
        kind === "comment"
          ? { body: "Submitted after removal" }
          : { expectedVersion: 1, title: "Submitted after removal" },
      ),
    );
    const response = await pending;
    expect(response.status).toBe(401);
    expect(await retainedData()).toEqual(before);
    expect(
      (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
  });
