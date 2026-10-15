import type { WorkerBindings } from "../../app/bindings";
const contexts = new WeakMap<
  D1Database,
  { available: boolean; origin: string; eventIds: Set<string> }
>();
export function notificationEmailAvailable(env: WorkerBindings): boolean {
  if (env.NOTIFICATION_EMAIL_ENABLED === "false" || !env.MAIL_FROM)
    return false;
  let origin: URL;
  try {
    origin = new URL(env.APP_ORIGIN);
  } catch {
    return false;
  }
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    return false;
  if (env.RER_DEMO === "1") return true;
  if (env.MAIL_MODE === "local-outbox")
    return ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) && Boolean(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32);
  return (
    origin.protocol === "https:" &&
    env.MAIL_PROVIDER === "sendgrid" &&
    Boolean(env.MAIL_API_KEY)
  );
}
export function configureNotifications(db: D1Database, env: WorkerBindings) {
  const available = notificationEmailAvailable(env);
  contexts.set(db, {
    available,
    origin: available ? new URL(env.APP_ORIGIN).origin : "",
    eventIds: new Set(),
  });
}
export function notificationContext(db: D1Database) {
  return contexts.get(db);
}
export async function needsNotificationDrain(db: D1Database) {
  const ids = notificationEventIds(db);
  if (!ids.length) return false;
  // Statements register candidate IDs before their transaction executes. Only
  // committed event receipts authorize a drain and its post-mail response fence.
  return (await db.prepare(
    "SELECT EXISTS(SELECT 1 FROM notification_events WHERE event_id IN (SELECT value FROM json_each(?))) AS committed",
  ).bind(JSON.stringify(ids)).first<number>("committed")) === 1;
}

export function notificationEventIds(db: D1Database) {
  return [...(contexts.get(db)?.eventIds ?? [])];
}
