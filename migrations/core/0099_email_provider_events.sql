ALTER TABLE team_email_intake ADD COLUMN event_verification_key TEXT;
ALTER TABLE intake_email_deliveries ADD COLUMN provider_outcome TEXT CHECK(provider_outcome IN('accepted','bounced'));
CREATE TABLE intake_email_provider_events (
 team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
 event_id TEXT NOT NULL,
 delivery_id TEXT NOT NULL REFERENCES intake_email_deliveries(id) ON DELETE CASCADE,
 outcome TEXT NOT NULL CHECK(outcome IN('accepted','bounced')),
 created_at TEXT NOT NULL,
 PRIMARY KEY(team_id,event_id)
);
CREATE TRIGGER intake_event_key_restore AFTER UPDATE OF phase ON rer_portability_jobs
WHEN NEW.kind='import' AND NEW.phase='complete' AND OLD.phase!='complete' BEGIN
 UPDATE team_email_intake SET event_verification_key=NULL;
END;
