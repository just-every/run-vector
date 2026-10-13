import { addIssueDeletionRoutes } from '../features/issue-deletion/routes';
import { addDuplicateRoutes } from '../features/duplicates/routes';
import { readProjectCycleHistory } from '../features/cycle-closure/read';
import { IntegrationError } from '../features/integrations/errors';
import { addIntegrationConfigRoutes } from '../features/integrations/config-routes';
import { addArchiveRoutes } from '../features/data/archive-routes';
import { addFirstRunRoutes } from '../features/first-run/routes';
import { addRestoreRoutes } from '../features/data/restore-routes';
import { addImportRoutes } from '../features/data/import/routes';
import { addErasureRoutes } from '../features/data/erasure/routes';
import { ImportError } from '../features/data/import/types';
import { identifierForSource } from '../features/data/import/issue-source';
import { PaginationInvalidated } from "../features/issues/list-revision";
import { addNotificationRoutes } from '../features/notifications/routes';
import { addViewRoutes } from '../features/views/routes';
import { addPreferenceRoutes } from '../features/views/preferences-routes';
import { addBulkIssueRoutes } from '../features/bulk-edit/routes';
import { addParentIssueRoutes } from '../features/parents/routes';
import { configureNotifications, needsNotificationDrain, notificationEventIds } from '../features/notifications/context';
import { drainNotificationMail } from '../features/notifications/mail';
import { fileSettlementDatabase } from '../features/auth/mutation-database';
import { addAdministrationRoutes } from '../features/administration/routes';
import { AuthError } from '../../../vendor/base/operator-auth/index.mjs';
import { mutationDatabase, isMutationAccessError, RestoreReservationError } from "../features/auth/mutation-database";
import { addSettingsRoutes } from '../features/settings/routes';
import { listIssues, issueListResponse } from "../features/issues/list";
import { issueListQuerySchema } from "../features/issues/list-schema";
import { moveIssueTeamRoute } from "../features/team-move/routes";
import {
  IssueAccessError,
  requireIssueAccess,
} from "../features/issues/access";
import {
  addDependencyRoute,
  removeDependencyRoute,
} from "../features/dependencies/routes";
import { createOperatorIntakeRoute } from "../features/operator-intake/routes";
import { returnIntakeRoute } from "../features/intake-return/routes";
import { RequestBodyError } from "./input";
import { admitRate } from "../features/auth/repository";
import { updateIssueRoute } from "../features/issue-edit/routes";
import { addDiscussionRoutes } from "../features/discussion/routes";
import { addLinkRoutes } from "../features/links/routes";
import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  acceptIssueRoute,
  createIssueRoute,
  declineIssueRoute,
  deferIssueRoute,
  getIssueDetail,
} from "../features/issues";
import { getProjectDetail, listProjectSummaries } from "../features/projects";
import { addSearchRoutes } from "../features/search";
import { ensureSampleData } from "../features/sample-data/service";
import {
  getCurrentStream,
  getMyWorkStream,
  loadWorkspaceSnapshot,
} from "../features/streams";
import { databaseIsReachable } from "../features/workspace/repository";
import { requireOperator } from "../features/auth/service";
import { operatorProjectionStatus } from "../features/auth/projection-admission";
import type { AppEnvironment } from "./bindings";

const timeQuerySchema = z.object({
  at: z.string().datetime({ offset: true }).optional(),
});
const booleanQuerySchema = timeQuerySchema.extend({
  includeArchived: z.enum(["true", "false"]).optional(),
});
const issueParamSchema = z.object({
  identifier: z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/),
});
const projectParamSchema = z.object({ projectId: z.string().length(26) });

export function createApiApp() {
  const app = new Hono<AppEnvironment>();

  app.onError((error, context) => {
    if (error instanceof RestoreReservationError) return context.json({error:'restore_in_progress',message:error.message},409);
    if (error instanceof IntegrationError)return context.json({error:error.code,message:error.message},error.status,{'Cache-Control':'no-store'});
    if (error instanceof ImportError)
      return context.json({error:error.code,message:error.message,...error.details},error.status,{'Cache-Control':'no-store'});
    if (error instanceof AuthError)
      return Response.json({ error: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    if (error instanceof RequestBodyError)
      return context.json(
        { error: "invalid_request", message: error.message },
        error.status,
      );
    if (isMutationAccessError(error))
      return context.json({ error: "unauthenticated", message: "Sign in again to continue." }, 401);
    console.error(error);
    return context.json(
      {
        error: "internal_error",
        message: "Unexpected server error.",
      },
      500,
    );
  });

  app.use("*", async (context, next) => {
    if (!context.env.DB) {
      return context.json(
        {
          error: "database_unavailable",
          message: "The DB binding is required.",
        },
        503,
      );
    }
    if (context.env.SEED_SAMPLE_DATA === "true") {
      await ensureSampleData(context.env.DB, new Date());
    }
    const operator = await requireOperator(context.env, context.req.raw);
    if (!operator) {
      return context.json(
        {
          error: "unauthenticated",
          message: "A native operator session is required.",
        },
        401,
      );
    }
    if (
      !["GET", "HEAD"].includes(context.req.method) &&
      context.req.header("origin") !== context.env.APP_ORIGIN
    )
      return context.json(
        { error: "forbidden", message: "Same-origin mutation required." },
        403,
      );
    context.header("Cache-Control", "no-store");
    if (
      !(await admitRate(context.env.DB, "operator:" + operator.id, 600, 60_000))
    )
      return context.json({ error: "rate_limited" }, 429);
    const admittedWorkspace = await context.env.DB.prepare("SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL").bind(operator.id).first<string>("workspace_id");
    context.set("operatorId", operator.id);
    if (!["GET", "HEAD"].includes(context.req.method)) {
      // Context owns this bindings object; never change the shared Worker env.
      context.env = { ...context.env, DB: mutationDatabase(context.env.DB, operator.id, operator.fence) };
    }
    configureNotifications(context.env.DB,context.env);
    try { await next(); } finally {
    // Only persisted intents are selected. A postcommit authorization failure
    // must hide the response without canceling recipients' committed mail.
    const preparedNotifications = notificationEventIds(context.env.DB).length > 0;
    const drained = await needsNotificationDrain(context.env.DB);
    if (drained) {
      try { await drainNotificationMail({...context.env,DB:fileSettlementDatabase(context.env.DB)},{eventIds:notificationEventIds(context.env.DB)}); }
      catch { console.error('Notification mail drain interrupted; durable intent retained for recovery.'); }
    }
    // Reads always retain their captured session through the last SQL snapshot.
    // Mutation mail projection keeps its existing fence; an explicit self-removal
    // acknowledgement remains successful after its own transaction revokes access.
    const read = ["GET", "HEAD"].includes(context.req.method);
    if (preparedNotifications || read) {
      const current = await requireOperator(context.env, context.req.raw);
      const admission = !current || current.id !== operator.id || JSON.stringify(current.fence) !== JSON.stringify(operator.fence)
        ? 401
        : await operatorProjectionStatus(context.env.DB, operator.id, admittedWorkspace, operator.fence);
      // Resource reads conceal membership changes; ordinary account and
      // post-mail projections retain their captured-workspace session denial.
      // An attempted mutation still needs the native-session fence when its
      // transaction wrote nothing. Its concealed resource denial remains 404;
      // the post-mail workspace fence applies only after a committed event.
      const concealWorkspaceChange = context.get("concealWorkspaceChange") || (!read && !drained);
      const status = admission === 404 && !concealWorkspaceChange ? 401 : admission;
      if (status !== 200) {
        // Hono carries prior response headers into replacements. Discard file
        // metadata and cancel projected bytes before installing the denial.
        for (const name of [...context.res.headers.keys()]) context.res.headers.delete(name);
        await context.res.body?.cancel();
        context.res = context.json({ error: status === 401 ? 'unauthenticated' : 'not_found' }, status, { 'Cache-Control': 'no-store' });
      }
    }
    }
  });

  addFirstRunRoutes(app);

  app.get("/session", (context) =>
    context.json({ operatorId: context.get("operatorId") }),
  );

  app.get("/current", async (context) => {
    const query = parseQuery(context, timeQuerySchema);
    if (!query.success) return query.response;
    return context.json(
      await getCurrentStream(context.env.DB, toNow(query.data.at)),
    );
  });

  app.get("/my-work", async (context) => {
    const query = parseQuery(context, timeQuerySchema);
    if (!query.success) return query.response;
    return context.json(
      await getMyWorkStream(
        context.env.DB,
        context.get("operatorId"),
        toNow(query.data.at),
      ),
    );
  });

  app.get("/issues", async (context) => {
    const query = parseQuery(context, issueListQuerySchema);
    if (!query.success) return query.response;
    try {
      return context.json(
        issueListResponse(await listIssues(context.env.DB, context.get("operatorId"), query.data)),
      );
    } catch (error) {
      if (!(error instanceof IssueAccessError) && !(error instanceof PaginationInvalidated)) throw error;
      return context.json(
        { error: error.code, message: error.message },
        error.status,
      );
    }
  });

  addBulkIssueRoutes(app);
  addParentIssueRoutes(app);

  app.get("/issues/:identifier", async (context) => {
    const parameters = issueParamSchema.safeParse(context.req.param());
    if (!parameters.success)
      return context.json(
        { error: "invalid_request", issues: parameters.error.issues },
        400,
      );
    const query = parseQuery(context, timeQuerySchema);
    if (!query.success) return query.response;
    try {
      const actor = context.get("operatorId");
      const identifier = await identifierForSource(context.env.DB, actor, parameters.data.identifier);
      await requireIssueAccess(
        context.env.DB,
        identifier,
        actor,
      );
      const issue = await getIssueDetail(
        context.env.DB,
        identifier,
        toNow(query.data.at),
      );
      await requireIssueAccess(
        context.env.DB,
        identifier,
        actor,
      );
      if (!issue)
        throw new IssueAccessError("not_found", "Issue is unavailable.", 404);
      return context.json(issue);
    } catch (error) {
      if (!(error instanceof IssueAccessError)) throw error;
      return context.json(
        { error: error.code, message: error.message },
        error.status,
      );
    }
  });

  app.patch("/issues/:identifier", updateIssueRoute);
  app.post("/issues/:identifier/team", moveIssueTeamRoute);
  app.post("/issues/:identifier/dependencies", addDependencyRoute);
  app.delete("/issues/:identifier/dependencies", removeDependencyRoute);
  addDiscussionRoutes(app);
  addIssueDeletionRoutes(app);
  addDuplicateRoutes(app);
  app.post("/issues", createIssueRoute);
  app.post("/intake", createOperatorIntakeRoute);
  app.post("/issues/:identifier/return", returnIntakeRoute);
  app.post("/issues/:identifier/accept", acceptIssueRoute);
  app.post("/issues/:identifier/defer", deferIssueRoute);
  app.post("/issues/:identifier/decline", declineIssueRoute);

  app.get("/projects", async (context) => {
    const query = parseQuery(context, booleanQuerySchema);
    if (!query.success) return query.response;
    const now = toNow(query.data.at);
    const projects = listProjectSummaries(
      await loadWorkspaceSnapshot(context.env.DB),
      now,
      query.data.includeArchived === "true",
    );
    const counts = projects.reduce<Record<string, number>>((total, project) => {
      if (project.health !== "none")
        total[project.health] = (total[project.health] ?? 0) + 1;
      total[project.lifecycle] = (total[project.lifecycle] ?? 0) + 1;
      return total;
    }, {});
    return context.json({ generatedAt: now.toISOString(), counts, projects });
  });

  app.get("/projects/:projectId", async (context) => {
    const parameters = projectParamSchema.safeParse(context.req.param());
    if (!parameters.success)
      return context.json(
        { error: "invalid_request", issues: parameters.error.issues },
        400,
      );
    const query = parseQuery(context, timeQuerySchema);
    if (!query.success) return query.response;
    const project = getProjectDetail(
      await loadWorkspaceSnapshot(context.env.DB),
      parameters.data.projectId,
      toNow(query.data.at),
    );
    return project
      ? context.json({...project,cycleHistory:await readProjectCycleHistory(context.env.DB,parameters.data.projectId)})
      : context.json(
          {
            error: "not_found",
            message: `Project ${parameters.data.projectId} does not exist.`,
          },
          404,
        );
  });

  addSearchRoutes(app);

  addNotificationRoutes(app);
  addViewRoutes(app);
  addPreferenceRoutes(app);
  addAdministrationRoutes(app);
  addSettingsRoutes(app);
  addIntegrationConfigRoutes(app);
  addRestoreRoutes(app);
  addArchiveRoutes(app);
  addImportRoutes(app);
  addErasureRoutes(app);
  addLinkRoutes(app);
  return app;
}

export async function healthResponse(
  binding: D1Database | undefined,
  shouldSeed: boolean,
): Promise<{ status: "ok" } | null> {
  if (!binding) return null;
  try {
    if (shouldSeed) await ensureSampleData(binding, new Date());
    await databaseIsReachable(binding);
    return { status: "ok" };
  } catch {
    return null;
  }
}

function parseQuery<T extends z.ZodType>(
  context: Context<AppEnvironment>,
  schema: T,
):
  { success: true; data: z.infer<T> } | { success: false; response: Response } {
  const parsed = schema.safeParse(context.req.query());
  return parsed.success
    ? { success: true, data: parsed.data }
    : {
        success: false,
        response: context.json(
          { error: "invalid_request", issues: parsed.error.issues },
          400,
        ),
      };
}

function toNow(value: string | undefined): Date {
  return value ? new Date(value) : new Date();
}
