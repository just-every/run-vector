import { z } from 'zod';
const id = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
/** This first rule family has stable identities, never display-name matching. */
export const ruleInput = z.object({
  name: z.string().trim().min(1).max(120), labelId: id,
  priority: z.enum(['none','urgent','high','medium','low']), destinationId: id,
  monthlyBudget: z.number().int().min(1).max(10000), enabled: z.boolean(),
}).strict();
export const ruleSave = ruleInput.extend({ expectedVersion: z.number().int().min(0) }).strict();
export type RuleInput = z.infer<typeof ruleInput>;
export type Rule = {
  id: string; workspace_id: string; team_id: string | null; owner_operator_id: string;
  name: string; label_id: string; priority: string; destination_id: string;
  monthly_budget: number; enabled: number; version: number; failure: string | null;
  failure_notified_at: string | null; created_at: string; updated_at: string;
};
export type Run = {
  id: string; rule_id: string; rule_version: number; event_id: string; issue_id: string;
  state: 'pending' | 'succeeded' | 'failed' | 'budget_exhausted' | 'stopped';
  changes_json: string; reason: string | null; created_at: string; completed_at: string | null; completion_token: string | null;
};
