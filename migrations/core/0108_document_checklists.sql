-- A checklist activity belongs to its retained, attributed document revision.
ALTER TABLE document_revisions ADD COLUMN checklist_json TEXT;
