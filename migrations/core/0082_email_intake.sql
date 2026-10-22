CREATE TABLE team_email_intake (
 team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
 address TEXT NOT NULL UNIQUE,
 allowed_senders_json TEXT NOT NULL DEFAULT '[]',
 acknowledgement INTEGER NOT NULL DEFAULT 0 CHECK(acknowledgement IN(0,1)),
 actor_operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE intake_email_messages (
 id TEXT PRIMARY KEY,
 team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
 message_key TEXT NOT NULL,
 message_id TEXT,
 issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
 comment_id TEXT REFERENCES issue_comments(id) ON DELETE SET NULL,
 root_id TEXT REFERENCES intake_email_messages(id) ON DELETE SET NULL,
 sender TEXT,
 requester_domain TEXT,
 subject TEXT,
 text_body TEXT,
 html_body TEXT,
 cc_json TEXT NOT NULL DEFAULT '[]',
 references_json TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL CHECK(status IN('processing','received','failed','erased','quarantined')),
 error TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(team_id,message_key)
);
CREATE INDEX intake_email_issue ON intake_email_messages(issue_id,created_at,id);
CREATE TABLE intake_email_files (
 message_id TEXT NOT NULL REFERENCES intake_email_messages(id) ON DELETE CASCADE,
 file_id TEXT NOT NULL REFERENCES issue_files(id) ON DELETE CASCADE,
 content_id TEXT,
 PRIMARY KEY(message_id,file_id)
);
CREATE TABLE intake_email_deliveries (
 id TEXT PRIMARY KEY,
 issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
 comment_id TEXT REFERENCES issue_comments(id) ON DELETE SET NULL,
 root_id TEXT REFERENCES intake_email_messages(id) ON DELETE SET NULL,
 request_id TEXT NOT NULL,
 message_id TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN('reply','acknowledgement')),
 status TEXT NOT NULL CHECK(status IN('processing','accepted','rejected','uncertain','failed','suppressed','quarantined')),
 error TEXT,
 provider_message_id TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(issue_id,request_id)
);
CREATE INDEX intake_email_delivery_comment ON intake_email_deliveries(comment_id);
-- Keep replay identities, while ordinary issue erasure removes mail content.
CREATE TRIGGER intake_email_issue_erased BEFORE DELETE ON issues BEGIN
 UPDATE intake_email_messages SET message_id=NULL,sender=NULL,requester_domain=NULL,subject=NULL,text_body=NULL,html_body=NULL,cc_json='[]',references_json='[]',status='erased',error=NULL WHERE issue_id=OLD.id;
 UPDATE intake_email_deliveries SET status='suppressed',error='issue_erased',provider_message_id=NULL WHERE issue_id=OLD.id;
END;
-- Destination authority is never inherited. Mail content and replay keys stay
-- portable; interrupted/historical submissions can never become sendable jobs.
CREATE TRIGGER intake_email_restore_complete AFTER UPDATE OF phase ON rer_portability_jobs
WHEN NEW.kind='import' AND NEW.phase='complete' AND OLD.phase!='complete' BEGIN
 UPDATE team_email_intake SET enabled=0,acknowledgement=0,actor_operator_id=NULL,revision=revision+1;
 UPDATE intake_email_messages SET status='quarantined' WHERE status IN('processing','failed');
 UPDATE intake_email_deliveries SET status='quarantined',error='restored_history' WHERE status='processing';
END;
