import { readRequestJson } from "../../app/input";
import { z } from "zod";
import type { Context } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { getIssueDetail } from "../issues/service";
import { IssueMutationError } from "../issues/errors";
import { updateIssueRecord } from "./repository";
const schema = z
  .object({
    expectedVersion: z.number().int().positive(),
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().max(100000).optional(),
    priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
    statusId: z.string().length(26).optional(),
    assigneeOperatorId: z.string().length(26).nullable().optional(),
    projectId: z.string().length(26).nullable().optional(),
    cycleId: z.string().length(26).nullable().optional(),
    estimate: z.number().int().min(1).max(100).nullable().optional(),
    dueDate: z.string().date().nullable().optional(),
    labelIds: z
      .array(z.string().length(26))
      .max(20)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Label IDs must be unique.",
      )
      .optional(),
    expectedOutcome: z
      .string()
      .trim()
      .max(20000)
      .nullable()
      .transform((value) => value || null)
      .optional(),
    customerImpact: z
      .string()
      .trim()
      .max(20000)
      .nullable()
      .transform((value) => value || null)
      .optional(),
    customFields: z.record(z.string(), z.json()).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, "At least one change is required.");
export type UpdateIssueInput = z.infer<typeof schema>;
export async function updateIssueRoute(c: Context<AppEnvironment>) {
  const identifier = c.req.param("identifier") ?? "";
  if (!/^[A-Z]{2,10}-[1-9][0-9]*$/.test(identifier))
    return c.json({ error: "invalid_request" }, 400);
  const parsed = schema.safeParse(await readRequestJson(c.req.raw));
  if (!parsed.success)
    return c.json(
      { error: "invalid_request", issues: parsed.error.issues },
      400,
    );
  try {
    const outcome = await updateIssueRecord(
      c.env.DB,
      identifier,
      c.get("operatorId"),
      parsed.data,
    );
    const issue = await getIssueDetail(c.env.DB, identifier, new Date());
    return outcome === "stale"
      ? c.json({ error: "stale_version", issue, version: issue?.version }, 409)
      : c.json(issue);
  } catch (error) {
    if (!(error instanceof IssueMutationError)) throw error;
    return c.json(
      { error: error.code, message: error.message },
      error.code === "issue_not_found"
        ? 404
        : error.code === "invalid_transition"
          ? 409
          : 400,
    );
  }
}
