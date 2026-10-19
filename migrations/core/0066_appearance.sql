-- Additive member preference; a member without a row follows the device (System).
CREATE TABLE operator_appearance (
 operator_id TEXT PRIMARY KEY REFERENCES operators(id) ON DELETE CASCADE,
 theme TEXT NOT NULL CHECK(theme IN ('light','dark','system')),
 revision TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
