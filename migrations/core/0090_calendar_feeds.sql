-- Feed capabilities are credentials, excluded from portable archives.
CREATE TABLE calendar_feed_tokens (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash)=64),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX calendar_feed_creator ON calendar_feed_tokens(creator_id,team_id);
