CREATE TABLE team_issue_sequences (
  team_id TEXT PRIMARY KEY REFERENCES teams(id),
  last_sequence INTEGER NOT NULL CHECK (last_sequence > 0),
  updated_at TEXT NOT NULL
);

INSERT INTO team_issue_sequences (team_id, last_sequence, updated_at)
SELECT team_id, MAX(sequence_number), MAX(updated_at)
FROM issues
GROUP BY team_id;
