import { z } from "zod";

export const restoreSchema = z.object({
  restored: z.boolean(),
  status: z.object({
    effectsHeld: z.union([z.literal(0), z.literal(1)]),
    reviewedAt: z.string().nullable(),
  }).nullable(),
  operators: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    approved: z.union([z.literal(0), z.literal(1)]),
    eligible: z.union([z.literal(0), z.literal(1)]),
  })),
});

export const grantSchema = z.object({ approved: z.literal(true) });
export const reviewEffectsSchema = z.object({
  reviewed: z.literal(true),
  historicalDeliveriesQuarantined: z.literal(true),
});
