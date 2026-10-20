import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { createApiApp } from "../../src/core/app/api";
import { createUlid } from "../../src/core/shared/ids";
import type { WorkerBindings } from "../../src/core/app/bindings";
import { bindings, origin, request } from "./base-auth-fixture";
import { collaborationFixture } from "./collaboration-fixture";
import { retainedData } from "./removal-fixture";

export async function privateState() {
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

export function callPrivate(
  path: string,
  cookie: string,
  options: RequestInit = {},
  extra: Partial<WorkerBindings> = {},
) {
  const requestOrigin = extra.APP_ORIGIN ?? origin;
  return createApiApp().request(
    requestOrigin + path,
    {
      ...options,
      headers: {
        origin: requestOrigin,
        host: new URL(requestOrigin).host,
        cookie,
        ...options.headers,
      },
    },
    { ...bindings, ...extra },
  );
}

const workspaceCleanups: Array<() => Promise<void>> = [];
export async function cleanupPrivateFixtures() {
  for (const cleanup of workspaceCleanups.splice(0)) await cleanup();
}

export async function privateFixture() {
  const f = await collaborationFixture();
  const issue = await f.create({ title: "Confidential issue projection" });
  expect(
    (
      await f.call(`/issues/${issue.identifier}/comments`, "POST", {
        body: "Confidential comment body",
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await f.call(`/issues/${issue.identifier}/links`, "POST", {
        name: "Confidential named link",
        url: "https://private.example.test/resource",
      })
    ).status,
  ).toBe(201);
  const upload = await callPrivate(
    `/issues/${issue.identifier}/files`,
    f.cookie,
    {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        "x-file-name": "Confidential-file.txt",
      },
      body: "Confidential stored R2 bytes",
    },
  );
  expect(upload.status, await upload.clone().text()).toBe(201);
  const file = (await upload.json()) as { id: string };
  const workspace = createUlid(new Date());
  const originalWorkspace = await env.DB.prepare(
    "SELECT workspace_id FROM operators WHERE id=?",
  )
    .bind(f.bob)
    .first<string>("workspace_id");
  const change = async (
    mode: "remove" | "signout" | "expire" | "workspace",
  ) => {
    if (mode === "remove")
      expect(
        (await f.call(`/settings/operators/${f.bob}`, "DELETE")).status,
      ).toBe(200);
    else if (mode === "signout")
      expect(
        (await request("/auth/signout", "POST", {}, f.bobCookie)).status,
      ).toBe(204);
    else if (mode === "expire")
      await env.DB.prepare(
        "UPDATE oa_sessions SET expires_at=? WHERE operator_id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)",
      )
        .bind(Date.now() - 1000, f.bob)
        .run();
    else {
      await env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)")
        .bind(workspace, "Foreign fixture workspace", "UTC", "now", "now")
        .run();
      workspaceCleanups.push(async () => {
        await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
          .bind(originalWorkspace, f.bob)
          .run();
        await env.DB.prepare("DELETE FROM workspace_settings WHERE id=?")
          .bind(workspace)
          .run();
      });
      await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
        .bind(workspace, f.bob)
        .run();
    }
  };
  return { ...f, issue, file, workspace, change };
}

/** Only scheduling is controlled: every query executes on genuine native D1. */
export function afterQuery(
  action: (query: string, method: "first" | "all") => Promise<void>,
) {
  const wrap = (
    statement: D1PreparedStatement,
    query: string,
  ): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, key) {
        if (key === "bind")
          return (...values: unknown[]) => wrap(target.bind(...values), query);
        if (key === "first")
          return async (column?: string) => {
            const result = await target.first(column);
            await action(query, "first");
            return result;
          };
        if (key === "all")
          return async () => {
            const result = await target.all();
            await action(query, "all");
            return result;
          };
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  return new Proxy(env.DB, {
    get(target, key) {
      if (key === "prepare")
        return (query: string) => wrap(target.prepare(query), query);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function observedBucket(afterGet: () => Promise<void> = async () => {}) {
  const calls = { get: 0, put: 0, delete: 0 };
  const bucket = new Proxy(env.FILES, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key === "get" || key === "put" || key === "delete")
        return async (...args: unknown[]) => {
          calls[key]++;
          const result = await (value as Function).apply(target, args);
          if (key === "get") await afterGet();
          return result;
        };
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { bucket, calls };
}

export function expectPrivateDenial(
  response: Response,
  body: string,
  status: number,
) {
  expect(response.status, body).toBe(status);
  expect(response.headers.get("content-disposition")).toBeNull();
  expect(response.headers.get("cache-control")).toContain("no-store");
  const data = JSON.parse(body);
  expect(data.error).toBe(status === 401 ? "unauthenticated" : "not_found");
  expect(
    Object.keys(data).every((key) => key === "error" || key === "message"),
  ).toBe(true);
  for (const value of [
    "Confidential",
    "private.example.test",
    "comments",
    "contentType",
    "blob_key",
  ]) {
    expect(body).not.toContain(value);
    expect(JSON.stringify([...response.headers])).not.toContain(value);
  }
}
