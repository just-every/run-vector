import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, inject } from "vitest";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { bindings, request, signIn, actor } from "./base-auth-fixture";
import type { Administration } from "../../src/core/features/administration/schema";
export async function setupAdministration() {
  await applyD1Migrations(env.DB, inject("migrations"));
  await bootstrapWorkspace(env.DB, bindings);
  const cookie = await signIn(),
    owner = await actor(cookie);
  const call = (path: string, method = "GET", body?: unknown) =>
    request("/api" + path, method, body, cookie);
  const state = async () =>
    (await (await call("/settings/administration")).json()) as Administration;
  const mutate = async (path: string, method: string, body?: unknown) => {
    const res = await call(path, method, body);
    expect([res.status, await res.clone().text()]).toEqual([
      200,
      expect.any(String),
    ]);
    return (await res.json()) as Administration;
  };
  const initial = await state();
  const create = async (extra: Record<string, unknown> = {}) => {
    const res = await call("/issues", "POST", {
      title: "Authored work",
      teamId: initial.teams[0].id,
      ...extra,
    });
    expect(res.status, await res.clone().text()).toBe(201);
    return (await res.json()) as {
      id: string;
      identifier: string;
      version: number;
      status: { id: string };
      cycle: { id: string } | null;
    };
  };
  return { cookie, owner, call, state, mutate, initial, create };
}
export function beforeBatch(run: () => Promise<unknown>) {
  let fired = false;
  return new Proxy(env.DB, {
    get(target, key) {
      if (key === "batch")
        return async (statements: D1PreparedStatement[]) => {
          if (!fired) {
            fired = true;
            await run();
          }
          return target.batch(statements);
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
