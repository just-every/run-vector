import { auditStatement } from "../../audit/producer";
import { z } from "zod";
import type { Hono } from "hono";
import type { AppEnvironment } from "../../../app/bindings";
import { readRequestJson } from "../../../app/input";
import { createUlid } from "../../../shared/ids";
import { createIssueInputSchema } from "../../issues/input";
import { planIssueRecord } from "../../issues/repository";
import { requireIssueAccess } from "../../issues/access";
import { sha256 } from "../../../../../vendor/base/integrations/core/crypto";
import { IntegrationError } from "../errors";
import { figmaLink } from "./urls";

export const pluginInput = z
  .object({
    captureId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    title: z.string().trim().min(1).max(500),
    teamId: z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/),
    figmaUrl: z
      .string()
      .max(2000)
      .refine((value) => Boolean(figmaLink(value))),
  })
  .strict();
export function addFigmaPluginRoute(app: Hono<AppEnvironment>) {
  app.post("/integrations/figma/issues", async (c) => {
    const parsed = pluginInput.safeParse(await readRequestJson(c.req.raw));
    if (!parsed.success)
      throw new IntegrationError(400, "invalid_figma_capture");
    const input = parsed.data,
      actor = c.get("operatorId"),
      db = c.env.DB;
    const workspace = await db
      .prepare(
        "SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL",
      )
      .bind(actor)
      .first<string>("workspace_id");
    if (!workspace) throw new IntegrationError(401, "invalid_token");
    const file = figmaLink(input.figmaUrl)!,
      fingerprint = await sha256(
        JSON.stringify({ ...input, figmaUrl: file.url }),
      );
    const receipt = () =>
      db
        .prepare(
          "SELECT fingerprint,issue_id FROM vector_figma_captures WHERE workspace_id=? AND operator_id=? AND capture_id=?",
        )
        .bind(workspace, actor, input.captureId)
        .first<{ fingerprint: string; issue_id: string | null }>();
    const replay = async (
      prior: NonNullable<Awaited<ReturnType<typeof receipt>>>,
    ) => {
      if (prior.fingerprint !== fingerprint || !prior.issue_id)
        throw new IntegrationError(409, "figma_capture_retired_or_changed");
      const issue = await db
        .prepare("SELECT identifier FROM issues WHERE id=?")
        .bind(prior.issue_id)
        .first<string>("identifier");
      if (!issue)
        throw new IntegrationError(409, "figma_capture_retired_or_changed");
      await requireIssueAccess(db, issue, actor);
      return c.json({ identifier: issue, replay: true });
    };
    const prior = await receipt();
    if (prior) return replay(prior);
    const now = new Date(),
      plan = await planIssueRecord(db, {
        actorOperatorId: actor,
        input: createIssueInputSchema.parse({
          title: input.title,
          teamId: input.teamId,
        }),
        now,
      });
    const linkId = createUlid(now),
      at = now.toISOString();
    const audit = auditStatement({
      workspace,
      actor,
      action: "figma.plugin_captured",
      subject: plan.issueId,
    });
    try {
      await db.batch([
        ...plan.writes,
        db.prepare(audit.sql).bind(...audit.params),
        db
          .prepare(
            "INSERT INTO issue_links(id,issue_id,actor_operator_id,name,url,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
          )
          .bind(linkId, plan.issueId, actor, "Figma", file.url, at, at),
        db
          .prepare(
            "INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at) VALUES(?,?,?,'link.created',?,?,?)",
          )
          .bind(
            createUlid(now),
            plan.issueId,
            actor,
            JSON.stringify({ id: linkId }),
            at,
            at,
          ),
        db
          .prepare(
            "INSERT INTO vector_figma_captures(workspace_id,operator_id,capture_id,fingerprint,issue_id,created_at) VALUES(?,?,?,?,?,?)",
          )
          .bind(
            workspace,
            actor,
            input.captureId,
            fingerprint,
            plan.issueId,
            at,
          ),
      ]);
    } catch (error) {
      const concurrent = await receipt();
      if (concurrent) return replay(concurrent);
      throw error;
    }
    return c.json({ identifier: plan.identifier, replay: false }, 201);
  });
}
