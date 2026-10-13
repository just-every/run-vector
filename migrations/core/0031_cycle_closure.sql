-- Additive cycle history. No live issue/project foreign keys: deletion keeps only identifiers.
CREATE TABLE cycle_snapshots (
 cycle_id TEXT PRIMARY KEY REFERENCES cycles(id),
 close_token TEXT NOT NULL UNIQUE,
 closed_at TEXT NOT NULL,
 next_cycle_id TEXT,
 body_json TEXT NOT NULL CHECK(json_valid(body_json))
);
CREATE TABLE cycle_membership_events (
 id TEXT PRIMARY KEY,
 cycle_id TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
 identifier TEXT NOT NULL,
 direction TEXT NOT NULL CHECK(direction IN ('added','removed')),
 occurred_at TEXT NOT NULL
);
CREATE INDEX cycle_membership_interval ON cycle_membership_events(cycle_id,occurred_at);
CREATE TABLE cycle_closure_failures (
 cycle_id TEXT PRIMARY KEY REFERENCES cycle_snapshots(cycle_id),
 identifiers_json TEXT NOT NULL CHECK(json_valid(identifiers_json)),
 created_at TEXT NOT NULL
);
-- Recover recorded changes from before this migration without rewriting old rows.
INSERT INTO cycle_membership_events
 SELECT a.id||':added',json_extract(a.next_value_json,'$.cycleId'),i.identifier,'added',a.created_at
 FROM issue_activity a JOIN issues i ON i.id=a.issue_id
 WHERE json_extract(a.next_value_json,'$.cycleId') IS NOT NULL
 AND json_extract(a.previous_value_json,'$.cycleId') IS NOT json_extract(a.next_value_json,'$.cycleId')
 AND EXISTS(SELECT 1 FROM cycles WHERE id=json_extract(a.next_value_json,'$.cycleId'));
INSERT INTO cycle_membership_events
 SELECT a.id||':removed',json_extract(a.previous_value_json,'$.cycleId'),i.identifier,'removed',a.created_at
 FROM issue_activity a JOIN issues i ON i.id=a.issue_id
 WHERE json_type(a.next_value_json,'$.cycleId') IS NOT NULL
 AND json_extract(a.previous_value_json,'$.cycleId') IS NOT NULL
 AND json_extract(a.previous_value_json,'$.cycleId') IS NOT json_extract(a.next_value_json,'$.cycleId')
 AND EXISTS(SELECT 1 FROM cycles WHERE id=json_extract(a.previous_value_json,'$.cycleId'));
CREATE TRIGGER cycle_membership_created AFTER INSERT ON issues WHEN NEW.cycle_id IS NOT NULL BEGIN
 INSERT INTO cycle_membership_events VALUES(lower(hex(randomblob(16))),NEW.cycle_id,NEW.identifier,'added',NEW.created_at);
END;
CREATE TRIGGER cycle_membership_changed AFTER UPDATE OF cycle_id ON issues WHEN NEW.cycle_id IS NOT OLD.cycle_id BEGIN
 INSERT INTO cycle_membership_events SELECT lower(hex(randomblob(16))),OLD.cycle_id,OLD.identifier,'removed',NEW.updated_at WHERE OLD.cycle_id IS NOT NULL;
 INSERT INTO cycle_membership_events SELECT lower(hex(randomblob(16))),NEW.cycle_id,NEW.identifier,'added',NEW.updated_at WHERE NEW.cycle_id IS NOT NULL;
END;
CREATE TRIGGER cycle_membership_deleted BEFORE DELETE ON issues WHEN OLD.cycle_id IS NOT NULL BEGIN
 INSERT INTO cycle_membership_events VALUES(lower(hex(randomblob(16))),OLD.cycle_id,OLD.identifier,'removed',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER cycle_closed_update BEFORE UPDATE ON cycles WHEN OLD.closed_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'CYCLE_CLOSED'); END;
CREATE TRIGGER cycle_closed_delete BEFORE DELETE ON cycles WHEN OLD.closed_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'CYCLE_CLOSED'); END;
CREATE TRIGGER cycle_closed_commit_insert BEFORE INSERT ON issues WHEN EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id AND closed_at IS NOT NULL) BEGIN SELECT RAISE(ABORT,'CYCLE_CLOSED'); END;
CREATE TRIGGER cycle_closed_commit_update BEFORE UPDATE OF cycle_id ON issues WHEN NEW.cycle_id IS NOT OLD.cycle_id AND EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id AND closed_at IS NOT NULL) BEGIN SELECT RAISE(ABORT,'CYCLE_CLOSED'); END;
CREATE TRIGGER cycle_snapshot_update BEFORE UPDATE ON cycle_snapshots BEGIN SELECT RAISE(ABORT,'CYCLE_SNAPSHOT_IMMUTABLE'); END;
CREATE TRIGGER cycle_snapshot_delete BEFORE DELETE ON cycle_snapshots BEGIN SELECT RAISE(ABORT,'CYCLE_SNAPSHOT_IMMUTABLE'); END;
CREATE TRIGGER cycle_failure_update BEFORE UPDATE ON cycle_closure_failures BEGIN SELECT RAISE(ABORT,'CYCLE_FAILURE_IMMUTABLE'); END;
CREATE TRIGGER cycle_failure_delete BEFORE DELETE ON cycle_closure_failures BEGIN SELECT RAISE(ABORT,'CYCLE_FAILURE_IMMUTABLE'); END;
