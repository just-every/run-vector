import { z } from "zod";
import { createUlid } from "../../shared/ids";
import { issueListQuerySchema } from "../issues/list-schema";
import { browseActor } from "../issues/browse-access";
import { IssueAccessError } from "../issues/access";
import { attentionReasons } from "../streams/ui/helpers";
import {
  type PreferenceSurface,
  type ListPreference,
  preferenceInputSchema,
} from "./schema";
import { ViewError, viewContext, writeViewState } from "./repository";
const {
  offset: _offset,
  revision: _revision,
  sort: _sort,
  grouping: _grouping,
  ...filterShape
} = issueListQuerySchema.shape;
const issueFilters = z.object(filterShape).strict();
const streamFilters = z
  .object({
    teamId: filterShape.team,
    projectId: filterShape.project,
    assigneeId: filterShape.assignee,
    priority: filterShape.priority,
    itemType: z.enum(["all", "intake", "issue"]).default("all"),
    attentionReason: z.enum(["all", ...attentionReasons]).default("all"),
  })
  .strict();
const projectFilters = z
  .object({
    includeArchived: z.boolean().default(false),
    label: z.union([z.literal("all"), z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)]).default("all"),
    lead: z.union([z.literal("all"), z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)]).default("all"),
    team: z.union([z.literal("all"), z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)]).default("all"),
    targetFrom: z.union([z.literal(""),z.string().date()]).default(""),
    targetTo: z.union([z.literal(""),z.string().date()]).default(""),
    lifecycle: z
      .enum(["all", "planned", "active", "completed", "canceled"])
      .default("all"),
    health: z
      .enum(["all", "blocked", "at-risk", "on-track", "unknown"])
      .default("all"),
  })
  .strict().refine(filters=>!filters.targetFrom||!filters.targetTo||filters.targetFrom<=filters.targetTo);
export function normalizePreference(
  surface: PreferenceSurface,
  input: z.output<typeof preferenceInputSchema>,
): ListPreference {
  const isList = surface === "issues" || surface === "board",
    isProject = surface === "projects";
  const filters = (
    isList ? issueFilters : isProject ? projectFilters : streamFilters
  ).safeParse(input.filters);
  const sort = (
    isList
      ? issueListQuerySchema.shape.sort
      : isProject
        ? z.enum(["newest", "priority"]).default("newest")
        : z.literal("priority").default("priority")
  ).safeParse(input.sort);
  const grouping = (
    isList
      ? issueListQuerySchema.shape.grouping
      : z.literal("none").default("none")
  ).safeParse(input.grouping);
  if (!filters.success || !sort.success || !grouping.success)
    throw new ViewError(
      "invalid_request",
      "Choose valid controls for this surface.",
      400,
    );
  if (
    isList &&
    !issueListQuerySchema.safeParse({
      ...filters.data,
      sort: sort.data,
      grouping: grouping.data,
    }).success
  )
    throw new ViewError(
      "invalid_request",
      "Choose a valid due date range.",
      400,
    );
  return {
    surface,
    filters: filters.data,
    sort: sort.data,
    grouping: grouping.data,
  };
}
export function defaultPreference(surface: PreferenceSurface) {
  return normalizePreference(surface, { filters: {} });
}
export async function getPreference(
  db: D1Database,
  actor: string,
  surface: PreferenceSurface,
): Promise<ListPreference> {
  const row = await db
    .prepare(
      `SELECT o.workspace_id,p.filters_json,p.sort,p.grouping
       FROM operators o JOIN workspace_settings w ON w.id=o.workspace_id
       LEFT JOIN list_preferences p ON p.operator_id=o.id AND p.surface=?
       WHERE o.id=? AND o.removed_at IS NULL`,
    )
    .bind(surface, actor)
    .first<{ workspace_id: string; filters_json: string | null; sort: string; grouping: string }>();
  if (!row) throw new IssueAccessError("unauthenticated", "The operator is no longer active in this workspace. Sign in again.", 401);
  await browseActor(db, actor, row.workspace_id);
  return row.filters_json !== null
    ? normalizePreference(surface, {
        filters: JSON.parse(row.filters_json),
        sort: row.sort,
        grouping: row.grouping,
      })
    : defaultPreference(surface);
}
export async function putPreference(
  db: D1Database,
  actor: string,
  surface: PreferenceSurface,
  input: z.output<typeof preferenceInputSchema>,
) {
  const value = normalizePreference(surface, input),
    ctx = await viewContext(db, actor);
  await writeViewState(ctx, [
    ctx.db
      .prepare(
        `INSERT INTO list_preferences(id,operator_id,surface,filters_json,sort,grouping,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)
 ON CONFLICT(operator_id,surface) DO UPDATE SET filters_json=excluded.filters_json,sort=excluded.sort,grouping=excluded.grouping,updated_at=excluded.updated_at`,
      )
      .bind(
        createUlid(new Date(ctx.at)),
        actor,
        surface,
        JSON.stringify(value.filters),
        value.sort,
        value.grouping,
        ctx.at,
        ctx.at,
      ),
  ]);
  return getPreference(db, actor, surface);
}
export async function resetPreference(
  db: D1Database,
  actor: string,
  surface: PreferenceSurface,
) {
  return putPreference(db, actor, surface, defaultPreference(surface));
}
