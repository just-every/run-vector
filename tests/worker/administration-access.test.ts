import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { setupAdministration, beforeBatch } from "./administration-fixture";
import { createServerApp } from "../../src/core/app/server";
import { bindings, request, invite, actor } from "./base-auth-fixture";
import {
  createTeam,
  removeStatus,
} from "../../src/core/features/administration/teams";
import { createProject } from "../../src/core/features/administration/projects";
import { createUlid } from "../../src/core/shared/ids";
import { mutationDatabase } from "../../src/core/features/auth/mutation-database";
const check = (ids: string, name: string, run: () => Promise<void>) =>
  contractWith(it, ids, name, run);
check(
  "OPS-001 OPS-004 TEAM-004",
  "every administration endpoint enforces native Origin and actor identity with atomic race-time fencing",
  async () => {
    const f = await setupAdministration(),
      app = createServerApp(),
      team = f.initial.teams[0];
    const endpoints: [string, string, unknown][] = [
      ["/settings/teams", "POST", { name: "Denied", identifierPrefix: "DEN" }],
      ["/settings/teams/" + team.id, "PATCH", { name: "Denied" }],
      [
        "/settings/teams/" + team.id + "/statuses",
        "POST",
        { name: "Denied", category: "started" },
      ],
      [
        "/settings/teams/" + team.id + "/statuses/order",
        "PUT",
        { statusIds: team.statuses.map((s) => s.id) },
      ],
      [
        "/settings/teams/" + team.id + "/statuses/" + team.statuses[0].id,
        "PATCH",
        { name: "Denied" },
      ],
      [
        "/settings/teams/" + team.id + "/statuses/" + team.statuses[0].id,
        "DELETE",
        { destinationStatusId: team.statuses[1].id },
      ],
      ["/settings/labels", "POST", { name: "Denied", color: "#112233" }],
      [
        "/settings/labels/" + createUlid(new Date()),
        "PATCH",
        { name: "Denied" },
      ],
      ["/settings/labels/" + createUlid(new Date()), "DELETE", undefined],
      [
        "/settings/projects",
        "POST",
        { name: "Denied", leadOperatorId: f.owner },
      ],
      [
        "/settings/projects/" + createUlid(new Date()),
        "PATCH",
        { name: "Denied" },
      ],
      [
        "/settings/cycles",
        "POST",
        {
          teamId: team.id,
          name: "Denied",
          startsLocal: "2026-01-01T00:00",
          endsLocal: "2026-01-02T00:00",
        },
      ],
    ];
    for (const [path, method, body] of endpoints) {
      expect((await request("/api" + path, method, body)).status, path).toBe(
        401,
      );
      const response = await app.request(
        bindings.APP_ORIGIN + "/api" + path,
        {
          method,
          headers: {
            host: new URL(bindings.APP_ORIGIN).host,
            origin: "https://foreign.test",
            cookie: f.cookie,
            "content-type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        bindings,
      );
      expect(response.status, path).toBe(403);
    }
    expect((await request("/api/settings/administration")).status).toBe(401);
    expect(
      (await request("/api/cycles/" + createUlid(new Date()))).status,
    ).toBe(401);
    expect(
      (
        await f.call("/settings/teams", "POST", {
          name: "Spoof",
          identifierPrefix: "SPOOF",
          actorOperatorId: f.owner,
        })
      ).status,
    ).toBe(400);
    const cookie = await invite("peer@base.test", f.cookie),
      peer = await actor(cookie);
    expect(
      (
        await request(
          "/api/settings/labels",
          "POST",
          { name: "Equal access", color: "#102030" },
          cookie,
        )
      ).status,
    ).toBe(200);
    const prefix = "RACE";
    const raced = beforeBatch(() =>
      env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?")
        .bind(new Date().toISOString(), peer)
        .run(),
    );
    await expect(
      createTeam(raced, peer, {
        name: "Denied after removal",
        identifierPrefix: prefix,
      }),
    ).rejects.toThrow(/session/);
    expect(
      await env.DB.prepare("SELECT id FROM teams WHERE identifier_prefix=?")
        .bind(prefix)
        .first(),
    ).toBeNull();
    await env.DB.prepare("UPDATE operators SET removed_at=NULL WHERE id=?")
      .bind(peer)
      .run();
    const old = team.statuses.find((s) => s.category === "backlog")!;
    const target = (
      await f.mutate("/settings/teams/" + team.id + "/statuses", "POST", {
        name: "Remap destination",
        category: "backlog",
      })
    ).teams
      .find((t) => t.id === team.id)!
      .statuses.find((s) => s.name === "Remap destination")!;
    const issue = await f.create();
    await expect(
      removeStatus(
        beforeBatch(() =>
          env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?")
            .bind(new Date().toISOString(), peer)
            .run(),
        ),
        peer,
        team.id,
        old.id,
        target.id,
      ),
    ).rejects.toThrow(/session/);
    expect(
      (await env.DB.prepare("SELECT version FROM issues WHERE id=?")
        .bind(issue.id)
        .first())!.version,
    ).toBe(1);
    await env.DB.prepare("UPDATE operators SET removed_at=NULL WHERE id=?")
      .bind(peer)
      .run();
    await expect(
      createProject(
        beforeBatch(() =>
          env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?")
            .bind(new Date().toISOString(), peer)
            .run(),
        ),
        f.owner,
        {
          name: "Raced lead",
          description: "",
          targetDate: null,
          leadOperatorId: peer,
        },
      ),
    ).rejects.toThrow(/conflicts/);
    expect(
      await env.DB.prepare(
        "SELECT id FROM projects WHERE name='Raced lead'",
      ).first(),
    ).toBeNull();
    // Preserve the stronger session fence when a repository wraps its database.
    await expect(
      createTeam(
        mutationDatabase(env.DB, f.owner, {
          sessionId: "missing-session",
          operatorVersion: 1,
        }),
        f.owner,
        { name: "Revoked session", identifierPrefix: "REVOKED" },
      ),
    ).rejects.toThrow(/session/);
  },
);
