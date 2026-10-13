import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject, it } from "vitest";
import { fixture } from "./removal-fixture";
import { createUlid } from "../../src/core/shared/ids";
import { savedViewSchema } from "../../src/core/features/views/schema";
it("[VIEW-002 VIEW-003 OPS-004] required removal transfers preserve board queries even at the successor limit and remove private views and preferences", async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  const f = await fixture();
  const body = {
    name: "Board work",
    layout: "board",
    query: { team: f.team, sort: "priority", grouping: "status" },
  };
  const sharedResponse = await f.request(
    "/views",
    "POST",
    { ...body, isShared: true },
    f.memberCookie,
  );
  expect(sharedResponse.status).toBe(201);
  const shared = savedViewSchema.parse(await sharedResponse.json());
  const privateResponse = await f.request(
    "/views",
    "POST",
    { ...body, name: "Private work" },
    f.memberCookie,
  );
  expect(privateResponse.status).toBe(201);
  const privateView = savedViewSchema.parse(await privateResponse.json());
  expect(
    (
      await f.request(
        "/preferences/board",
        "PUT",
        { filters: { team: f.team }, sort: "status", grouping: "status" },
        f.memberCookie,
      )
    ).status,
  ).toBe(200);
  await env.DB.batch(
    Array.from({ length: 100 }, (_, i) =>
      env.DB.prepare(
        "INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,created_at,updated_at) VALUES(?,?,?,?,'issues','now','now')",
      ).bind(
        createUlid(new Date()),
        f.workspace,
        f.owner,
        i === 0 ? "Board work" : `Owner view ${i}`,
      ),
    ),
  );
  expect((await f.remove()).status).toBe(200);
  const transferred = savedViewSchema.parse(
    await (await f.request("/views/" + shared.id)).json(),
  );
  expect(transferred.ownerOperatorId).toBe(f.owner);
  expect(transferred.layout).toBe("board");
  expect(transferred.query).toEqual(shared.query);
  expect(transferred.name).toBe("Board work (transferred)");
  expect((await f.request("/views/" + privateView.id)).status).toBe(404);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM list_preferences WHERE operator_id=?",
    )
      .bind(f.member)
      .first<number>("n"),
  ).toBe(0);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM saved_views WHERE owner_operator_id=?",
    )
      .bind(f.owner)
      .first<number>("n"),
  ).toBe(101);
  expect(
    (await f.request("/views", "POST", { name: "No new slot", query: {} }))
      .status,
  ).toBe(409);
});
