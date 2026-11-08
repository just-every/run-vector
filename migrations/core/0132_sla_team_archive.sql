-- Team withdrawal stops every existing clock in the archive transaction, even
-- when the team is restored before the next scheduled observation.
CREATE TRIGGER sla_team_archived AFTER UPDATE OF archived_at ON teams
WHEN NEW.archived_at IS NOT NULL
BEGIN
 UPDATE issue_sla_clocks
 SET stopped_at=COALESCE(stopped_at,NEW.archived_at),
     stop_reason=COALESCE(stop_reason,'stopped'),
     revision=lower(hex(randomblob(16)))
 WHERE team_id=NEW.id AND stopped_at IS NULL;
END;

-- Populate the same stop for teams already archived at upgrade. Retain all
-- elapsed time, target snapshots and occurrence receipts without replay.
UPDATE issue_sla_clocks
SET stopped_at=(SELECT archived_at FROM teams WHERE id=issue_sla_clocks.team_id),
    stop_reason='stopped',revision=lower(hex(randomblob(16)))
WHERE stopped_at IS NULL
AND EXISTS(SELECT 1 FROM teams WHERE id=issue_sla_clocks.team_id AND archived_at IS NOT NULL);
