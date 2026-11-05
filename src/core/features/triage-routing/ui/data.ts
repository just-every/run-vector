import { z } from 'zod';

const ruleSchema = z.object({ id: z.string(), name: z.string(), sourceId: z.string(), targetTeamId: z.string() });

/** One scope's saved ordered rules, with the Sentry connections and visible intake teams it may choose. */
export const routingViewSchema = z.object({
  version: z.number(),
  configuredBy: z.string().nullable(),
  configuredByName: z.string().nullable(),
  rules: z.array(ruleSchema),
  sources: z.array(z.object({ id: z.string(), name: z.string(), teamId: z.string() })),
  teams: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type RoutingView = z.output<typeof routingViewSchema>;
export type RoutingRule = z.output<typeof ruleSchema>;

/** The rule that placed a routed item, recorded when the item was created. */
export const routingProvenanceSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  revision: z.number(),
  scope: z.enum(['team', 'workspace']),
  configuredBy: z.string().nullable(),
  configuredByName: z.string().nullable(),
  sourceId: z.string(),
});
export type RoutingProvenance = z.output<typeof routingProvenanceSchema>;
