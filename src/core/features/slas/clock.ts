import type { SlaInput } from "./schema";
export type Clock = {
  issue_id: string;
  team_id: string;
  rule_json: string;
  timezone: string;
  started_at: string;
  observed_at: string;
  elapsed_minutes: number;
  stopped_at: string | null;
  stop_reason: string | null;
  revision: string;
};
export const matches = `(json_extract(r.body_json,'$.priority') IS NULL OR json_extract(r.body_json,'$.priority')=i.priority)
 AND (json_extract(r.body_json,'$.labelId') IS NULL OR EXISTS(SELECT 1 FROM issue_labels l WHERE l.issue_id=i.id AND l.label_id=json_extract(r.body_json,'$.labelId')))`;
export const held = `NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)`;
export function clockRule(clock: Clock) {
  return JSON.parse(clock.rule_json) as SlaInput;
}
