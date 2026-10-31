import { activeRecipient, visibleRecipient } from "../notifications/events";
import { visibleTeam } from "../roles/visibility-sql";
export type DueCandidate = {
  id: string;
  due_date: string;
  version: number;
  assignee_operator_id: string;
  cycle_id: string | null;
};
export type DueRuleClock = {
  id: string;
  version: number;
  workspace_id: string;
  timezone: string;
};
// Discovery is advisory. The claim rechecks current rule authority, visibility,
// issue state, clock, restore admission and active cycle inside one transaction.
export const eligible = `FROM issues i JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id
  JOIN workspace_settings w ON w.id=t.workspace_id JOIN workspace_due_rules r ON r.workspace_id=w.id
  JOIN operators o ON o.id=i.assignee_operator_id AND o.workspace_id=w.id
  JOIN operators owner ON owner.id=r.owner_operator_id AND owner.workspace_id=w.id
  WHERE r.enabled=1 AND owner.role IN ('owner','admin') AND ${activeRecipient.replaceAll("o.", "owner.")}
    AND ${visibleTeam("owner", "i.team_id")} AND ${visibleRecipient}
    AND i.archived_at IS NULL AND t.archived_at IS NULL AND s.category NOT IN ('intake','completed','canceled','duplicate')
    AND (i.cycle_id IS NULL OR EXISTS(SELECT 1 FROM cycles existing WHERE existing.id=i.cycle_id AND existing.closed_at IS NULL))
    AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)`;
export const activeCycle = `(SELECT c.id FROM cycles c WHERE c.team_id=i.team_id AND c.closed_at IS NULL
  AND julianday(c.starts_at)<=julianday(?) AND julianday(c.ends_at)>julianday(?) ORDER BY c.starts_at,c.id LIMIT 1)`;
export function calendarDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}
