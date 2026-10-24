CREATE TABLE issue_reactions (
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL CHECK (emoji IN ('👍','❤️','🎉','👀','🚀','👎')),
  actor_operator_id TEXT NOT NULL REFERENCES operators(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (issue_id,target_id,emoji,actor_operator_id)
);
CREATE INDEX issue_reactions_actor ON issue_reactions(actor_operator_id);
