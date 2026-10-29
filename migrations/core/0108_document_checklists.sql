-- Tick attribution is retained with its one immutable document revision.
ALTER TABLE document_revisions ADD COLUMN checklist_json TEXT
 CHECK(checklist_json IS NULL OR json_valid(checklist_json));
