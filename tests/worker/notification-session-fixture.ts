import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { bindings, request, signIn } from "./base-auth-fixture";
import { collaborationFixture } from "./collaboration-fixture";
import { testCookie } from "./native-fixture";
import { createUlid } from "../../src/core/shared/ids";

export type Invalidation =
  "signout" | "remove" | "expire" | "captured" | "version" | "workspace";
const cleanups: Array<() => Promise<void>> = [];

export async function cleanupSessionFixtures() {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM access_rate_limits"),
    env.DB.prepare("DELETE FROM oa_limits"),
  ]);
}

export async function notificationSessionFixture(hosted = false) {
  const f = await collaborationFixture();
  const cookie = hosted ? await testCookie(env.DB, f.bob) : f.bobCookie;
  const currentBindings = hosted
    ? { ...bindings, APP_ORIGIN:"https://vector.example.test", MAIL_MODE:"production", MAIL_PROVIDER:"sendgrid", MAIL_API_KEY:"test-only-provider-key" }
    : bindings;
  const nativeQuery = "SELECT o.id,o.name,o.email,o.workspace_id AS workspaceId";
  const bobEmail = (await env.DB.prepare(
    "SELECT email FROM operators WHERE id=?",
  )
    .bind(f.bob)
    .first<string>("email"))!;
  const replacementCookie = async () =>
    hosted ? testCookie(env.DB, f.bob) : signIn(bobEmail);
  async function invalidate(mode: Invalidation) {
    if (mode === "signout" || mode === "captured") {
      expect(
        (await request("/auth/signout", "POST", {}, cookie, currentBindings))
          .status,
      ).toBe(204);
    } else if (mode === "remove") {
      expect(
        (await f.call(`/settings/operators/${f.bob}`, "DELETE")).status,
      ).toBe(200);
    } else if (mode === "expire") {
        await env.DB.prepare(
          "UPDATE oa_sessions SET expires_at=? WHERE operator_id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)",
        )
          .bind(Date.now() - 1000, f.bob)
          .run();
    } else if (mode === "version") {
      await env.DB.prepare(
        "UPDATE oa_operators SET version=version+1 WHERE id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)",
      )
        .bind(f.bob)
        .run();
    } else {
      const original = await env.DB.prepare(
        "SELECT workspace_id FROM operators WHERE id=?",
      )
        .bind(f.bob)
        .first<string>("workspace_id");
      const workspace = createUlid(new Date());
      await env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)")
        .bind(workspace, "Other workspace", "UTC", "now", "now")
        .run();
      cleanups.push(async () => {
        await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
          .bind(original, f.bob)
          .run();
        await env.DB.prepare("DELETE FROM workspace_settings WHERE id=?")
          .bind(workspace)
          .run();
      });
      await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
        .bind(workspace, f.bob)
        .run();
    }
  }
  return {
    ...f,
    sessionCookie: cookie,
    currentBindings,
    nativeQuery,
    replacementCookie,
    invalidate,
  };
}

/** Schedule actual native changes after real D1 statements; never substitute data. */
export function afterNativeStatement(action: (query: string) => Promise<void>) {
  const queries = new WeakMap<D1PreparedStatement,string>();
  const originals = new WeakMap<D1PreparedStatement,D1PreparedStatement>();
  const wrap = (
    statement: D1PreparedStatement,
    query: string,
  ): D1PreparedStatement => {
    const wrapped = new Proxy(statement, {
      get(target, key) {
        if (key === "bind")
          return (...values: unknown[]) => wrap(target.bind(...values), query);
        if (key === "first" || key === "all" || key === "run")
          return async (...args: unknown[]) => {
            const result = await (target[key] as Function).apply(target, args);
            await action(query);
            return result;
          };
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    queries.set(wrapped,query); originals.set(wrapped,statement); return wrapped;
  };
  return new Proxy(env.DB, {
    get(target, key) {
      if (key === "batch") return async (items:D1PreparedStatement[]) => {const result=await target.batch(items.map(item=>originals.get(item)??item));for(const item of items)await action(queries.get(item)??"native batch");return result;};
      if (key === "prepare")
        return (query: string) => wrap(target.prepare(query), query);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
