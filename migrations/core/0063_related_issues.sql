-- REL-007: unordered pairs, independent of the blocking graph. The first endpoint
-- owns imported pairs so reversal can remove them before the earlier endpoint.
CREATE TABLE issue_relations (
  first_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  second_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(first_issue_id,second_issue_id),
  CHECK(first_issue_id <> second_issue_id)
);
CREATE UNIQUE INDEX issue_relations_pair ON issue_relations(min(first_issue_id,second_issue_id),max(first_issue_id,second_issue_id));
CREATE INDEX issue_relations_second ON issue_relations(second_issue_id);
