CREATE TABLE magic_links (
 id TEXT PRIMARY KEY, operator_id TEXT NOT NULL REFERENCES operators(id), token_hash TEXT NOT NULL UNIQUE,
 return_to TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE local_mail_outbox (
 id TEXT PRIMARY KEY, recipient TEXT NOT NULL, sign_in_url TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE access_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL);
