-- Additive native duplicate decisions and identifier-only deletion receipts.
CREATE TABLE issue_duplicates (
 issue_id TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
 canonical_issue_id TEXT NOT NULL REFERENCES issues(id),
 created_at TEXT NOT NULL,
 CHECK(issue_id<>canonical_issue_id)
);
CREATE INDEX issue_duplicates_canonical ON issue_duplicates(canonical_issue_id);
CREATE TRIGGER issue_duplicate_insert_guard BEFORE INSERT ON issue_duplicates BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM issue_duplicates WHERE issue_id=NEW.canonical_issue_id OR canonical_issue_id=NEW.issue_id)
 OR NOT EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN issues c ON c.id=NEW.canonical_issue_id JOIN teams ct ON ct.id=c.team_id WHERE i.id=NEW.issue_id AND t.workspace_id=ct.workspace_id AND NOT EXISTS(SELECT 1 FROM workflow_statuses s WHERE s.id=c.status_id AND s.category='duplicate'))
 THEN RAISE(ABORT,'issue_duplicate_target') END;
END;
CREATE TRIGGER issue_duplicate_update_guard BEFORE UPDATE ON issue_duplicates BEGIN
 SELECT CASE WHEN NEW.issue_id<>OLD.issue_id OR NEW.issue_id=NEW.canonical_issue_id
 OR EXISTS(SELECT 1 FROM issue_duplicates WHERE issue_id=NEW.canonical_issue_id)
 OR NOT EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN issues c ON c.id=NEW.canonical_issue_id JOIN teams ct ON ct.id=c.team_id WHERE i.id=NEW.issue_id AND t.workspace_id=ct.workspace_id AND NOT EXISTS(SELECT 1 FROM workflow_statuses s WHERE s.id=c.status_id AND s.category='duplicate'))
 THEN RAISE(ABORT,'issue_duplicate_target') END;
END;
CREATE TABLE issue_deletions (
 issue_id TEXT PRIMARY KEY,
 identifier TEXT NOT NULL UNIQUE,
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 requested_at TEXT NOT NULL
);
CREATE INDEX issue_deletions_workspace ON issue_deletions(workspace_id,identifier);
-- Retains event identity and prevents stale enqueue/transport after erasure.
CREATE TABLE vector_webhook_erasures (
 namespace TEXT NOT NULL,
 id TEXT NOT NULL,
 identifier TEXT NOT NULL,
 erased_at TEXT NOT NULL,
 PRIMARY KEY(namespace,id)
);
CREATE TRIGGER erased_webhook_enqueue BEFORE INSERT ON integration_deliveries
 WHEN EXISTS(SELECT 1 FROM vector_webhook_erasures WHERE namespace=NEW.namespace AND id=NEW.id)
 BEGIN SELECT RAISE(ABORT,'webhook_erased'); END;
CREATE TRIGGER erased_webhook_payload BEFORE UPDATE OF envelope ON integration_deliveries
 WHEN EXISTS(SELECT 1 FROM vector_webhook_erasures WHERE namespace=NEW.namespace AND id=NEW.id) AND json_extract(NEW.envelope,'$.body')<>'{}'
 BEGIN SELECT RAISE(ABORT,'webhook_erased'); END;
CREATE TRIGGER erased_webhook_event BEFORE UPDATE OF body ON vector_webhook_events
 WHEN EXISTS(SELECT 1 FROM vector_webhook_erasures WHERE namespace=NEW.workspace_id AND id=NEW.id) AND NEW.body<>'{}'
 BEGIN SELECT RAISE(ABORT,'webhook_erased'); END;
CREATE TRIGGER erased_webhook_claim BEFORE UPDATE OF state ON integration_deliveries
 WHEN NEW.state='sending' AND OLD.state<>'sending' AND EXISTS(SELECT 1 FROM vector_webhook_erasures WHERE namespace=NEW.namespace AND id=NEW.id)
 BEGIN SELECT RAISE(IGNORE); END;

-- Expand/copy/swap the source identity keys. Raw IDs and erased digests have
-- disjoint uniqueness domains, including a raw ID equal to another ID's digest.
-- Existing columns, values and key order are preserved; erased defaults to live.
-- These 0028 tables have no foreign keys, secondary indexes or triggers.
CREATE TABLE vector_source_records_next (
 source_id TEXT NOT NULL,record_id TEXT NOT NULL,issue_id TEXT NOT NULL,created_at TEXT NOT NULL,
 erased INTEGER NOT NULL DEFAULT 0 CHECK(erased IN(0,1)),
 PRIMARY KEY(source_id,record_id,erased)
);
INSERT INTO vector_source_records_next(source_id,record_id,issue_id,created_at)
 SELECT source_id,record_id,issue_id,created_at FROM vector_source_records;
DROP TABLE vector_source_records;
ALTER TABLE vector_source_records_next RENAME TO vector_source_records;
CREATE TABLE vector_source_receipts_next (
 source_id TEXT NOT NULL,record_id TEXT NOT NULL,revision_id TEXT NOT NULL,payload_hash TEXT NOT NULL,
 issue_id TEXT NOT NULL,evidence_id TEXT NOT NULL,received_at TEXT NOT NULL,
 erased INTEGER NOT NULL DEFAULT 0 CHECK(erased IN(0,1)),
 PRIMARY KEY(source_id,record_id,revision_id,erased)
);
INSERT INTO vector_source_receipts_next(source_id,record_id,revision_id,payload_hash,issue_id,evidence_id,received_at)
 SELECT source_id,record_id,revision_id,payload_hash,issue_id,evidence_id,received_at FROM vector_source_receipts;
DROP TABLE vector_source_receipts;
ALTER TABLE vector_source_receipts_next RENAME TO vector_source_receipts;

-- Receiver inbox identities survive, while historical envelopes cannot be restored.
CREATE TRIGGER erased_webhook_replay_insert BEFORE INSERT ON integration_replays
 WHEN EXISTS(SELECT 1 FROM vector_webhook_erasures WHERE namespace=NEW.namespace AND id=NEW.id)
 OR EXISTS(SELECT 1 FROM issue_deletions WHERE workspace_id=NEW.namespace AND identifier=json_extract(CASE WHEN json_valid(json_extract(NEW.envelope,'$.body')) THEN json_extract(NEW.envelope,'$.body') ELSE '{}' END,'$.identifier'))
 BEGIN SELECT RAISE(ABORT,'webhook_erased'); END;
CREATE TRIGGER erased_webhook_replay_update BEFORE UPDATE OF envelope ON integration_replays
 WHEN EXISTS(SELECT 1 FROM vector_webhook_erasures WHERE namespace=NEW.namespace AND id=NEW.id) AND json_extract(NEW.envelope,'$.body')<>'{}'
 OR EXISTS(SELECT 1 FROM issue_deletions WHERE workspace_id=NEW.namespace AND identifier=json_extract(CASE WHEN json_valid(json_extract(NEW.envelope,'$.body')) THEN json_extract(NEW.envelope,'$.body') ELSE '{}' END,'$.identifier'))
 BEGIN SELECT RAISE(ABORT,'webhook_erased'); END;
-- Late operator reconciliation retains its decision but no free-form evidence code.
CREATE TRIGGER erased_webhook_resolution AFTER INSERT ON integration_resolutions
 WHEN EXISTS(SELECT 1 FROM vector_webhook_erasures WHERE namespace=NEW.namespace AND id=NEW.delivery_id)
 BEGIN UPDATE integration_resolutions SET outcome=json_set(outcome,'$.code','issue_deleted') WHERE namespace=NEW.namespace AND id=NEW.id; END;
CREATE TRIGGER erased_webhook_resolution_update BEFORE UPDATE OF outcome ON integration_resolutions
 WHEN EXISTS(SELECT 1 FROM vector_webhook_erasures WHERE namespace=NEW.namespace AND id=NEW.delivery_id) AND json_extract(NEW.outcome,'$.code')<>'issue_deleted'
 BEGIN SELECT RAISE(ABORT,'webhook_erased'); END;
