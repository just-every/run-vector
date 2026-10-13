-- A comment imported from another tracker keeps its original author's name as a
-- read-only snapshot. No operator is created for that person; the importing
-- operator holds the row's native authority.
ALTER TABLE issue_comments ADD COLUMN imported_author_name TEXT CHECK(imported_author_name IS NULL OR length(imported_author_name) BETWEEN 1 AND 200);
