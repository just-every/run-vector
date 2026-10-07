import { z } from "zod";
import { isSafeHttpsUrl } from "../links/schema";
const link = z
  .string()
  .max(2000)
  .refine(
    isSafeHttpsUrl,
    "Use a HTTPS URL without credentials or control characters.",
  )
  .nullable()
  .optional()
  .default(null);
const text = z.string().trim().max(20000).nullable().optional().default(null);
export const operatorIntakeInputSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    teamId: z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/),
    description: z.string().max(100000).optional().default(""),
    observedAt: z.string().datetime({ offset: true }).optional(),
    summary: z.string().trim().max(100000).optional(),
    link,
    measurements: z
      .record(
        z
          .string()
          .min(1)
          .max(100)
          .refine(
            (value) => value === value.trim() && value.length > 0,
            "Use a measurement name without surrounding whitespace.",
          ),
        z.union([z.string().max(20000), z.number(), z.boolean(), z.null()]),
      )
      .refine(
        (value) => Object.keys(value).length <= 50,
        "Use at most 50 measurements.",
      )
      .optional()
      .default({}),
    customerReports: z
      .array(
        z
          .object({
            customer: z.string().trim().max(500).optional(),
            summary: z.string().trim().min(1).max(100000),
            link,
          })
          .strict(),
      )
      .max(50)
      .optional()
      .default([]),
    expectedOutcome: text,
    customerImpact: text,
  })
  .strict();
export type OperatorIntakeInput = z.output<typeof operatorIntakeInputSchema>;
