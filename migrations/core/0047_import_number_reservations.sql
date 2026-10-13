-- Reserve the complete reviewed range in the same transaction as job creation.
-- The existing prefix high-water mark is deliberately never rewound by rollback.
CREATE TABLE vector_import_allocations (
 job_id TEXT NOT NULL REFERENCES ik_jobs(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 identifier_prefix TEXT NOT NULL COLLATE NOCASE,
 first_sequence INTEGER NOT NULL CHECK(first_sequence > 0),
 last_sequence INTEGER NOT NULL CHECK(last_sequence >= first_sequence),
 PRIMARY KEY(job_id,identifier_prefix)
);

-- Vector retained plain canonical JSON, split into ordered chunks for large
-- plans. Reserve outstanding legacy effects before any post-upgrade native
-- creation can advance their prefix. Never rewrite a reviewed job or source.
CREATE VIEW vector_import_upgrade_ranges AS
WITH plans AS (
 SELECT j.id,j.rowid AS rank,j.destination,j.checkpoint,
 CASE WHEN json_extract(j.plan_json,'$.d1Plan')=1 THEN
  (SELECT group_concat(body,'') FROM (SELECT body FROM ik_d1_plan_chunks WHERE job_id=j.id ORDER BY ordinal))
 ELSE j.plan_json END AS body
 FROM ik_jobs j WHERE j.namespace LIKE 'vector-import:%' AND j.state IN ('queued','applying','failed')
), remaining AS (
 SELECT p.id,p.rank,p.destination,json_extract(e.value,'$.value.issue.origin_prefix') AS prefix,
 json_extract(e.value,'$.value.issue.sequence_number') AS sequence
 FROM plans p,json_each(p.body,'$.entries') entry,json_each(entry.value,'$.effects') e
 JOIN teams t ON t.id=json_extract(e.value,'$.value.issue.team_id') AND t.workspace_id=p.destination
 WHERE entry.key>=p.checkpoint AND COALESCE(json_extract(entry.value,'$.erased'),0)=0
 AND json_extract(e.value,'$.targetKind')='issue'
 AND NOT EXISTS(SELECT 1 FROM issues WHERE id=json_extract(e.value,'$.targetId'))
)
SELECT id,rank,destination,prefix,MIN(sequence) AS first_sequence,MAX(sequence) AS last_sequence
FROM remaining GROUP BY id,destination,prefix;
INSERT INTO vector_import_allocations(job_id,workspace_id,identifier_prefix,first_sequence,last_sequence)
SELECT r.id,r.destination,r.prefix,r.first_sequence,r.last_sequence FROM vector_import_upgrade_ranges r
WHERE r.first_sequence>COALESCE((SELECT last_sequence FROM issue_prefix_sequences WHERE workspace_id=r.destination AND identifier_prefix=r.prefix),0)
AND NOT EXISTS(SELECT 1 FROM vector_import_upgrade_ranges prior WHERE prior.rank<r.rank AND prior.destination=r.destination AND prior.prefix=r.prefix
 AND prior.first_sequence<=r.last_sequence AND prior.last_sequence>=r.first_sequence
 AND prior.first_sequence>COALESCE((SELECT last_sequence FROM issue_prefix_sequences WHERE workspace_id=prior.destination AND identifier_prefix=prior.prefix),0));
INSERT INTO issue_prefix_sequences(workspace_id,identifier_prefix,last_sequence,updated_at)
SELECT workspace_id,identifier_prefix,MAX(last_sequence),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM vector_import_allocations
WHERE 1 GROUP BY workspace_id,identifier_prefix
ON CONFLICT(workspace_id,identifier_prefix) DO UPDATE SET last_sequence=MAX(issue_prefix_sequences.last_sequence,excluded.last_sequence),updated_at=excluded.updated_at;
-- Overlap or already consumed numbers predate this migration. Surface that
-- existing conflict immediately; rollback review preserves later native work.
UPDATE vector_import_runs SET last_error='import_number_conflict: This older run already overlaps allocated issue numbers. Review and confirm rollback if there is no later native work, then preview again. Existing issues and allocated numbers are preserved.',last_error_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE EXISTS(SELECT 1 FROM vector_import_upgrade_ranges r WHERE r.id=job_id AND NOT EXISTS(SELECT 1 FROM vector_import_allocations a WHERE a.job_id=r.id AND a.identifier_prefix=r.prefix));
DROP VIEW vector_import_upgrade_ranges;
