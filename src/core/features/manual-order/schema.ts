import { z } from "zod";

const id = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const identifier = z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
const scope = { teamId: id.optional(), viewId: id.optional() };
export const manualOrderScopeSchema = z
  .object(scope)
  .strict()
  .refine((value) => Boolean(value.teamId || value.viewId), {
    message: "Choose a team or saved view.",
  });
export const moveManualOrderSchema = z
  .object({
    ...scope,
    identifier,
    action: z.enum(["up", "down", "top", "before", "after"]),
    anchor: identifier.optional(),
    expectedVersion: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.teamId && !value.viewId)
      ctx.addIssue({ code: "custom", message: "Choose a team or saved view." });
    const anchored = value.action === "before" || value.action === "after";
    if (anchored !== Boolean(value.anchor))
      ctx.addIssue({
        code: "custom",
        path: ["anchor"],
        message: "Before and after require an anchor; other moves do not.",
      });
    if (value.anchor === value.identifier)
      ctx.addIssue({
        code: "custom",
        path: ["anchor"],
        message: "Choose another issue as the anchor.",
      });
  });
export const manualOrderStateSchema = z.object({
  version: z.number().int().nonnegative(),
});
export type ManualOrderScope = z.output<typeof manualOrderScopeSchema>;
export type ManualOrderMove = z.output<typeof moveManualOrderSchema>;
