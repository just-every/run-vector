-- Retain the stable provider record ID alongside its human issue key.
-- Both identities use the same Owner-controlled prefix.
INSERT OR IGNORE INTO issue_aliases(workspace_id,source,source_key,prefix,issue_id)
SELECT a.workspace_id,a.source,trim(json_extract(h.next_value_json,'$.sourceId')),a.prefix,a.issue_id
FROM issue_activity h JOIN issue_aliases a ON a.issue_id=h.issue_id
 AND a.source=json_extract(h.next_value_json,'$.source')
 AND a.source_key=upper(json_extract(h.next_value_json,'$.sourceKey')) COLLATE NOCASE
WHERE h.kind='issue.imported' AND json_type(h.next_value_json,'$.sourceId')='text'
 AND trim(json_extract(h.next_value_json,'$.sourceId'))<>'';
