-- Workspace label groups: stable identity, plus exclusivity enforced by the
-- database so every issue writer (create, update, bulk, copy, undo, restore and
-- mapped import) shares one transactional rule. Existing labels stay ungrouped.
CREATE TABLE label_groups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  name TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, name)
);
ALTER TABLE labels ADD COLUMN group_id TEXT REFERENCES label_groups(id);
CREATE INDEX labels_group_idx ON labels(group_id) WHERE group_id IS NOT NULL;
CREATE TRIGGER label_group_workspace_insert BEFORE INSERT ON labels
WHEN NEW.group_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM label_groups g WHERE g.id=NEW.group_id AND g.workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'invalid_label_group'); END;
CREATE TRIGGER label_group_workspace_update BEFORE UPDATE OF group_id,workspace_id ON labels
WHEN NEW.group_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM label_groups g WHERE g.id=NEW.group_id AND g.workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'invalid_label_group'); END;
-- A group may only be defined over labels no issue already carries together.
CREATE TRIGGER label_group_membership BEFORE UPDATE OF group_id ON labels
WHEN NEW.group_id IS NOT NULL AND EXISTS(
  SELECT 1 FROM issue_labels mine JOIN issue_labels other ON other.issue_id=mine.issue_id AND other.label_id<>mine.label_id
  JOIN labels sibling ON sibling.id=other.label_id
  WHERE mine.label_id=NEW.id AND sibling.group_id=NEW.group_id)
BEGIN SELECT RAISE(ABORT,'label_group_conflict'); END;
-- Applying a label refuses an issue that already carries another label of its group.
CREATE TRIGGER issue_label_group_insert BEFORE INSERT ON issue_labels
WHEN EXISTS(
  SELECT 1 FROM labels added JOIN labels sibling ON sibling.group_id=added.group_id AND sibling.id<>added.id
  JOIN issue_labels held ON held.label_id=sibling.id
  WHERE added.id=NEW.label_id AND held.issue_id=NEW.issue_id)
BEGIN SELECT RAISE(ABORT,'label_group_conflict'); END;
CREATE TRIGGER issue_label_group_update BEFORE UPDATE OF issue_id,label_id ON issue_labels
WHEN EXISTS(
  SELECT 1 FROM labels added JOIN labels sibling ON sibling.group_id=added.group_id AND sibling.id<>added.id
  JOIN issue_labels held ON held.label_id=sibling.id
  WHERE added.id=NEW.label_id AND held.issue_id=NEW.issue_id AND NOT (held.issue_id=OLD.issue_id AND held.label_id=OLD.label_id))
BEGIN SELECT RAISE(ABORT,'label_group_conflict'); END;
