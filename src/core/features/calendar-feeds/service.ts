import { IssueAccessError } from "../issues/access";
import { createUlid } from "../../shared/ids";
import { activeRecipient } from "../notifications/events";
import { SettingsError } from "../settings/repository";
import { visibilityDatabase } from "../roles/visibility-database";
import { readCalendarEvents } from "./events";
import { calendarIcs } from "./ics";

type Feed = { id: string; workspace_id: string; creator_id: string; team_id: string | null; token_hash: string; version: number; created_at: string; updated_at: string; revoked_at: string | null };
export async function calendarAuthority(db: D1Database, actor: string) {
  const access = await db.prepare(`SELECT o.workspace_id,o.role FROM operators o WHERE o.id=? AND ${activeRecipient}`)
    .bind(actor).first<{ workspace_id: string; role: string }>();
  if (!access) throw new SettingsError("unauthenticated", "Sign in to manage calendar feeds.", 401);
  if (access.role === "guest") throw new SettingsError("forbidden", "Guests cannot manage calendar feeds.", 403);
  return access;
}
async function belongs(db: D1Database, actor: string, team: string, workspace: string) {
  return !!await db.prepare("SELECT 1 FROM team_members m JOIN teams t ON t.id=m.team_id WHERE m.operator_id=? AND m.team_id=? AND t.workspace_id=?")
    .bind(actor, team, workspace).first();
}
async function hash(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), b => b.toString(16).padStart(2, "0")).join("");
}
async function capability() {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  return { token, hash: await hash(token) };
}
function receipt(id: string, token: string, version: number, origin: string) {
  return { id, url: origin + "/api/calendar/feed/" + token + ".ics", version };
}
export async function listFeeds(db: D1Database, actor: string) {
  const access = await calendarAuthority(db, actor);
  const leadership = ["owner", "admin"].includes(access.role);
  const rows = (await db.prepare(`SELECT f.*,t.name team_name FROM calendar_feed_tokens f
    LEFT JOIN teams t ON t.id=f.team_id WHERE f.workspace_id=? AND
    (f.creator_id=? OR (?=1 AND f.team_id IN(SELECT team_id FROM team_members WHERE operator_id=?)))
    ORDER BY f.created_at DESC,f.id`).bind(access.workspace_id, actor, Number(leadership), actor).all<Feed & { team_name: string | null }>()).results;
  const teams = (await db.prepare("SELECT t.id,t.name FROM teams t JOIN team_members m ON m.team_id=t.id WHERE m.operator_id=? AND t.workspace_id=? AND t.archived_at IS NULL ORDER BY t.name,t.id")
    .bind(actor, access.workspace_id).all<{ id: string; name: string }>()).results;
  return { feeds: rows.map(f => ({
    id: f.id, teamId: f.team_id, teamName: f.team_name, creatorId: f.creator_id, version: f.version,
    createdAt: f.created_at, updatedAt: f.updated_at, revokedAt: f.revoked_at,
    canRotate: f.creator_id === actor && (!f.team_id || teams.some(t => t.id === f.team_id)) && !f.revoked_at,
    canRevoke: !f.revoked_at,
  })), teams };
}
export async function createFeed(db: D1Database, actor: string, team: string | null, origin: string) {
  const access = await calendarAuthority(db, actor);
  if (team && !await belongs(db, actor, team, access.workspace_id)) throw new SettingsError("forbidden", "Join this team before creating its calendar feed.", 403);
  const at = new Date().toISOString(), id = createUlid(new Date(at)), key = await capability();
  const result = await db.prepare(`INSERT INTO calendar_feed_tokens(id,workspace_id,creator_id,team_id,token_hash,created_at,updated_at)
    SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM operators o WHERE o.id=? AND o.role<>'guest' AND ${activeRecipient})
    AND (? IS NULL OR EXISTS(SELECT 1 FROM team_members WHERE operator_id=? AND team_id=?))`)
    .bind(id, access.workspace_id, actor, team, key.hash, at, at, actor, team, actor, team).run();
  if (result.meta.changes !== 1) throw new SettingsError("forbidden", "Calendar access changed. Refresh and try again.", 403);
  return receipt(id, key.token, 1, origin);
}
export async function changeFeed(db: D1Database, actor: string, id: string, version: number, rotate: boolean, origin: string) {
  const access = await calendarAuthority(db, actor);
  const feed = await db.prepare("SELECT * FROM calendar_feed_tokens WHERE id=? AND workspace_id=?").bind(id, access.workspace_id).first<Feed>();
  if (!feed) throw new SettingsError("not_found", "Calendar feed is unavailable.", 404);
  const member = feed.team_id ? await belongs(db, actor, feed.team_id, access.workspace_id) : false;
  const allowed = rotate ? feed.creator_id === actor && (!feed.team_id || member)
    : feed.creator_id === actor || ["owner", "admin"].includes(access.role) && member;
  if (!allowed) throw new SettingsError("forbidden", "You cannot change this calendar feed.", 403);
  const key = rotate ? await capability() : null, at = new Date().toISOString();
  const result = await db.prepare(`UPDATE calendar_feed_tokens SET token_hash=?,revoked_at=?,updated_at=?,version=version+1
    WHERE id=? AND workspace_id=? AND version=? AND revoked_at IS NULL
    AND EXISTS(SELECT 1 FROM operators o WHERE o.id=? AND o.role=? AND ${activeRecipient})
    AND (?=0 OR EXISTS(SELECT 1 FROM team_members WHERE operator_id=? AND team_id=?))`)
    .bind(key?.hash ?? feed.token_hash, rotate ? null : at, at, id, access.workspace_id, version,
      actor, access.role, Number(rotate && !!feed.team_id || feed.creator_id !== actor), actor, feed.team_id).run();
  if (result.meta.changes !== 1) throw new SettingsError("conflict", "This feed changed. Refresh and try again.", 409);
  return key ? receipt(id, key.token, version + 1, origin) : { revoked: true };
}
const eligible = `o.removed_at IS NULL AND o.role<>'guest' AND ${activeRecipient}
  AND (f.team_id IS NULL OR EXISTS(SELECT 1 FROM team_members member WHERE member.operator_id=o.id AND member.team_id=f.team_id))
  AND EXISTS(SELECT 1 FROM vector_auth_operators mapping JOIN oa_operators native ON native.id=mapping.auth_id WHERE mapping.operator_id=o.id AND native.status='active')`;
export async function feedContent(source: D1Database, value: string, origin: string) {
  if (!/^[a-f0-9]{64}\.ics$/.test(value)) return null;
  const digest = await hash(value.slice(0, -4));
  const select = `SELECT f.* FROM calendar_feed_tokens f JOIN operators o ON o.id=f.creator_id AND o.workspace_id=f.workspace_id
    WHERE f.token_hash=? AND f.revoked_at IS NULL AND ${eligible}`;
  const feed = await source.prepare(select).bind(digest).first<Feed>();
  if (!feed) return null;
  const db = visibilityDatabase(source, feed.creator_id);
  let events;
  try { events = await readCalendarEvents(db, feed.creator_id, feed.team_id ? { kind: "team", teamId: feed.team_id } : { kind: "personal" }, origin); }
  catch (error) {
    if (error instanceof IssueAccessError || error instanceof SettingsError && [401,403,404].includes(error.status)) return null;
    throw error;
  }
  // Rotation, revocation and current creator authority are checked again after
  // the projection, before any event leaves this request.
  if (!await source.prepare(select).bind(digest).first()) return null;
  return calendarIcs(events);
}
