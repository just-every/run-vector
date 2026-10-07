import { z } from "zod";

export const dependencyInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    relatedIdentifier: z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/),
    relatedVersion: z.number().int().positive(),
    direction: z.enum(["blocks", "blocked-by"]),
  })
  .strict();

export type DependencyInput = z.output<typeof dependencyInputSchema>;
