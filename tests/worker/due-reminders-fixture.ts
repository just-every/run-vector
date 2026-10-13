import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { setupAdministration } from "./administration-fixture";
import { bindings } from "./base-auth-fixture";
import { scheduled } from "../../src/core/app/scheduled";
export const tick = (instant: string, db = env.DB) =>
  scheduled(
    { scheduledTime: Date.parse(instant) },
    { ...bindings, DB: db, NOTIFICATION_EMAIL_ENABLED: "true" },
  );
export async function reminderFixture() {
  const f = await setupAdministration();
  const created: string[] = [];
  const configure = async (timezone: string, reminderTime = "09:00") => {
    expect(
      (await f.call("/settings", "PATCH", { timezone, reminderTime })).status,
    ).toBe(200);
  };
  const notifications = async () => {
    const response = await f.call("/notifications");
    expect(response.status).toBe(200);
    const page = (await response.json()) as {
      items: { identifier: string; causes: string[]; createdAt: string }[];
    };
    return page.items.filter(
      (n) =>
        n.causes.includes("due_reminder") && created.includes(n.identifier),
    );
  };
  const create = async (extra: Record<string, unknown> = {}) => {
    const issue = await f.create({
      assigneeOperatorId: f.owner,
      dueDate: "2026-10-11",
      ...extra,
    });
    created.push(issue.identifier);
    return issue;
  };
  return { ...f, configure, notifications, create };
}
export async function effectCounts() {
  const tables = [
    "issue_activity",
    "audit_records",
    "notification_events",
    "notification_candidates",
    "notification_deliveries",
    "notification_delivery_attempts",
    "notification_mail_audit",
    "rer_mail_development_outbox",
    "vector_webhook_events",
    "integration_deliveries",
    "integration_attempts",
    "integration_resolutions",
    "integration_replays",
    "vector_github_deliveries",
  ];
  return Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => [
        table,
        await env.DB.prepare(`SELECT count(*) n FROM ${table}`).first("n"),
      ]),
    ),
  );
}

/** Inject between reminder discovery and its atomic claim, after earlier Cron services. */
export function beforeReminderClaim(run: () => Promise<unknown>) {
  let discovered = false,
    fired = false;
  return new Proxy(env.DB, {
    get(target, key) {
      if (key === "prepare")
        return (sql: string) => {
          if (sql.startsWith("INSERT INTO due_reminder_suppressions"))
            discovered = true;
          return target.prepare(sql);
        };
      if (key === "batch")
        return async (statements: D1PreparedStatement[]) => {
          if (discovered && !fired) {
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
