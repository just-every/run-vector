-- Intrinsic PNG dimensions are portable attachment metadata. Historical files retain NULL.
ALTER TABLE issue_files ADD COLUMN image_width INTEGER CHECK(image_width IS NULL OR image_width > 0);
ALTER TABLE issue_files ADD COLUMN image_height INTEGER CHECK(image_height IS NULL OR image_height > 0);
