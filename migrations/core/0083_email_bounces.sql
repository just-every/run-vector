-- Preserve accepted submission history; a later provider bounce is irreversible.
ALTER TABLE intake_email_deliveries ADD COLUMN bounced_at TEXT;
CREATE INDEX intake_email_delivery_provider ON intake_email_deliveries(provider_message_id);
