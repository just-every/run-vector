import { IssueAccessError } from "./access";
export async function browseActor(
  db: D1Database,
  actor: string,
  expectedWorkspace?: string,
) {
  const row = await db
    .prepare(
      `SELECT o.workspace_id,w.timezone FROM operators o JOIN workspace_settings w ON w.id=o.workspace_id WHERE o.id=? AND o.removed_at IS NULL`,
    )
    .bind(actor)
    .first<{ workspace_id: string; timezone: string }>();
  if (
    !row ||
    (expectedWorkspace !== undefined && row.workspace_id !== expectedWorkspace)
  )
    throw new IssueAccessError(
      "unauthenticated",
      "The operator is no longer active in this workspace. Sign in again.",
      401,
    );
  return row;
}
export function workspaceDate(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("-");
}
