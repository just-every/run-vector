import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { createApiApp } from "../../src/core/app/api";
import { bindings, origin } from "./base-auth-fixture";
import { endIntakeDeferral } from "../../src/core/features/intake-return/service";
import { beforeBatch } from "./administration-fixture";
contractWith(
  it,
  "BASE-ACCESS-004 NOTIFY-001 INTAKE-006",
  "human deferral return rejects foreign workspace at admission and inside the native mutation transaction",
  async () => {
    const f = await collaborationFixture(),
      r = await f.call("/intake", "POST", {
        title: "Private return",
        teamId: f.initial.teams[0].id,
      }),
      issue = (await r.json()) as { id: string; identifier: string };
    const deadline = new Date(Date.now() + 3600_000).toISOString();
    expect(
      (
        await f.call(`/issues/${issue.identifier}/defer`, "POST", {
          expectedVersion: 1,
          returnAt: deadline,
        })
      ).status,
    ).toBe(200);
    const previous = (await env.DB.prepare(
      "SELECT workspace_id FROM operators WHERE id=?",
    )
      .bind(f.bob)
      .first<string>("workspace_id"))!;
    const destination = "01J00000000000000000000791";
    await env.DB.prepare(
      "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,'Other workspace','UTC','now','now')",
    )
      .bind(destination)
      .run();
    await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
      .bind(destination, f.bob)
      .run();
    const app = createApiApp();
    const response = await app.request(
      origin + `/issues/${issue.identifier}/return`,
      {
        method: "POST",
        headers: {
          host: new URL(origin).host,
          origin,
          cookie: f.bobCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ expectedVersion: 2 }),
      },
      bindings,
    );
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("Private return");
    await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
      .bind(previous, f.bob)
      .run();
    const db = beforeBatch(() =>
      env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
        .bind(destination, f.bob)
        .run(),
    );
    expect(await endIntakeDeferral(db, issue.identifier, f.bob, 2)).toBe(
      "stale",
    );
    expect(
      await env.DB.prepare("SELECT deferred_until FROM issues WHERE id=?")
        .bind(issue.id)
        .first<string>("deferred_until"),
    ).toBe(deadline);
    expect(
      await count("notifications", "causes_json LIKE '%intake_return%'"),
    ).toBe(0);
  },
);
