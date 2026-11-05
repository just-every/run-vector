import { z } from 'zod';
const id = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
export const routingRule = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  sourceId: id,
  targetTeamId: id,
}).strict();
export const routingInput = z.object({
  expectedVersion: z.number().int().min(0),
  rules: z.array(routingRule).max(32),
}).strict().refine(input => new Set(input.rules.map(rule => rule.id)).size === input.rules.length);
export type RoutingRule = z.infer<typeof routingRule>;
export type RoutingInput = z.infer<typeof routingInput>;
export type RoutingConfig = {
  workspace_id: string; scope_key: string; team_id: string | null;
  version: number; configured_by: string | null; rules_json: string;
};
