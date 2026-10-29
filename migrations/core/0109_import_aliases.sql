-- Imported aliases are identities, never a second issue or a credential.
CREATE TABLE issue_alias_prefixes (
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  PRIMARY KEY(workspace_id,prefix)
);
CREATE TABLE issue_aliases (
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_key TEXT NOT NULL COLLATE NOCASE,
  prefix TEXT NOT NULL COLLATE NOCASE,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  PRIMARY KEY(workspace_id,source,source_key,issue_id),
  FOREIGN KEY(workspace_id,prefix) REFERENCES issue_alias_prefixes(workspace_id,prefix)
);
CREATE INDEX issue_aliases_target ON issue_aliases(issue_id);

-- Backfill retained import history without changing any native issue.
INSERT OR IGNORE INTO issue_alias_prefixes(workspace_id,prefix)
SELECT t.workspace_id,upper(substr(COALESCE(json_extract(a.next_value_json,'$.sourceKey'),json_extract(a.next_value_json,'$.sourceId')),1,instr(COALESCE(json_extract(a.next_value_json,'$.sourceKey'),json_extract(a.next_value_json,'$.sourceId')),'-')-1))
FROM issue_activity a JOIN issues i ON i.id=a.issue_id JOIN teams t ON t.id=i.team_id
WHERE a.kind='issue.imported' AND COALESCE(json_extract(a.next_value_json,'$.sourceKey'),json_extract(a.next_value_json,'$.sourceId')) GLOB '*-[0-9]*';
INSERT OR IGNORE INTO issue_aliases(workspace_id,source,source_key,prefix,issue_id)
SELECT t.workspace_id,json_extract(a.next_value_json,'$.source'),upper(COALESCE(json_extract(a.next_value_json,'$.sourceKey'),json_extract(a.next_value_json,'$.sourceId'))),upper(substr(COALESCE(json_extract(a.next_value_json,'$.sourceKey'),json_extract(a.next_value_json,'$.sourceId')),1,instr(COALESCE(json_extract(a.next_value_json,'$.sourceKey'),json_extract(a.next_value_json,'$.sourceId')),'-')-1)),i.id
FROM issue_activity a JOIN issues i ON i.id=a.issue_id JOIN teams t ON t.id=i.team_id
WHERE a.kind='issue.imported' AND json_extract(a.next_value_json,'$.source') IS NOT NULL
AND COALESCE(json_extract(a.next_value_json,'$.sourceKey'),json_extract(a.next_value_json,'$.sourceId')) GLOB '*-[0-9]*';
