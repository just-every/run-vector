import { z } from "zod";
export const identifierSchema = z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
export const subissueRuleSchema = z.object({
  enabled: z.boolean(),
  version: z.number().int().nonnegative(),
});
export const subissuesSchema = z.object({
  identifier: identifierSchema,
  version: z.number().int().positive(),
  teamId: z.string(),
  completed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  rule: subissueRuleSchema,
  children: z.array(
    z.object({
      id: z.string(),
      identifier: identifierSchema,
      title: z.string(),
      version: z.number().int().positive(),
      status: z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
      }),
      assignee: z.object({ id: z.string(), name: z.string() }).nullable(),
    }),
  ),
});
export type SubissuesData = z.output<typeof subissuesSchema>;
export const createSubissueSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    title: z.string().trim().min(1).max(500),
  })
  .strict();
export const reorderSubissuesSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    identifiers: z
      .array(identifierSchema)
      .max(4000)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Sub-issues must be unique.",
      ),
  })
  .strict();
export const updateSubissueRuleSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    enabled: z.boolean(),
  })
  .strict();
