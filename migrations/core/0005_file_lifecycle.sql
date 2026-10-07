ALTER TABLE issue_files ADD COLUMN state TEXT NOT NULL DEFAULT 'ready' CHECK(state IN ('pending','ready','failed'));
