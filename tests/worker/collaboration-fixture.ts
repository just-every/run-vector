import type { WorkerBindings } from "../../src/core/app/bindings";
import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { setupAdministration } from "./administration-fixture";
import { invite, actor, request, bindings } from "./base-auth-fixture";
import { mutationDatabase } from "../../src/core/features/auth/mutation-database";
import { configureNotifications } from "../../src/core/features/notifications/context";
import { createIssueRecord } from "../../src/core/features/issues/repository";
import { createIssueInputSchema } from "../../src/core/features/issues/input";
export async function collaborationFixture() {
  const f = await setupAdministration();
  for (const table of [
    "notification_candidates",
    "notification_deliveries",
    "notifications",
    "issue_mentions",
    "issue_followers",
    "issue_notification_mutes",
    "notification_preferences",
    "notification_type_mutes",
    "issue_deferral_origins",
  ])
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  const suffix = crypto.randomUUID();
  const bobCookie = await invite(`bob-${suffix}@collaboration.test`, f.cookie),
    bob = await actor(bobCookie);
  const caraCookie = await invite(
      `cara-${suffix}@collaboration.test`,
      f.cookie,
    ),
    cara = await actor(caraCookie);
  const call = (cookie: string, path: string, method = "GET", body?: unknown) =>
    request("/api" + path, method, body, cookie);
  const data = async (cookie: string, path: string) => {
    const r = await call(cookie, path);
    expect(r.status, await r.clone().text()).toBe(200);
    return r.json() as Promise<any>;
  };
  const pending = async (
    extra: Record<string, unknown> = {},
    mailBindings: WorkerBindings = bindings,
  ) => {
    const db = mutationDatabase(env.DB, f.owner);
    configureNotifications(db, mailBindings);
    return createIssueRecord(db, {
      actorOperatorId: f.owner,
      now: new Date(),
      input: createIssueInputSchema.parse({
        title: "Mail title",
        teamId: f.initial.teams[0].id,
        assigneeOperatorId: bob,
        ...extra,
      }),
    });
  };
  return { ...f, bob, cara, bobCookie, caraCookie, any: call, data, pending };
}
export async function count(
  table: string,
  where = "1",
  params: unknown[] = [],
) {
  const selected = table === "notification_development_mail" ? `(SELECT json_extract(message,'$.deliveryId') AS delivery_id,json_extract(message,'$.to[0]') AS recipient,json_extract(message,'$.subject') AS subject,json_extract(message,'$.text') AS text,created_at FROM rer_mail_development_outbox WHERE json_extract(message,'$.text') LIKE '%'||char(10)||'Sign in to view this issue.')` : table;
  return env.DB.prepare(`SELECT count(*) n FROM ${selected} WHERE ${where}`)
    .bind(...params)
    .first<number>("n");
}
