-- Historical releases keep unknown ownership; only native creation supplies it.
ALTER TABLE releases ADD COLUMN owner_operator_id TEXT REFERENCES operators(id);

CREATE TABLE release_note_drafts (
 release_id TEXT PRIMARY KEY REFERENCES releases(id) ON DELETE CASCADE,
 owner_operator_id TEXT NOT NULL REFERENCES operators(id),
 body TEXT NOT NULL,
 sources_json TEXT NOT NULL CHECK(json_valid(sources_json)),
 source_release_version INTEGER NOT NULL CHECK(source_release_version>0),
 version INTEGER NOT NULL CHECK(version>0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 erased_at TEXT
);

CREATE TABLE release_note_revisions (
 release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version>0),
 owner_operator_id TEXT NOT NULL REFERENCES operators(id),
 actor_operator_id TEXT NOT NULL REFERENCES operators(id),
 body TEXT NOT NULL,
 sources_json TEXT NOT NULL CHECK(json_valid(sources_json)),
 source_release_version INTEGER NOT NULL CHECK(source_release_version>0),
 created_at TEXT NOT NULL,
 PRIMARY KEY(release_id,version)
);
