-- Additive member preferences leave historical operator archive rows unchanged.
CREATE TABLE operator_personal_time (
 operator_id TEXT PRIMARY KEY REFERENCES operators(id) ON DELETE CASCADE,
 timezone TEXT,
 working_hours_start TEXT NOT NULL CHECK(length(working_hours_start)=5 AND working_hours_start GLOB '[0-2][0-9]:[0-5][0-9]' AND substr(working_hours_start,1,2)<'24'),
 working_hours_end TEXT NOT NULL CHECK(length(working_hours_end)=5 AND working_hours_end GLOB '[0-2][0-9]:[0-5][0-9]' AND substr(working_hours_end,1,2)<'24' AND working_hours_end>working_hours_start),
 working_days_json TEXT NOT NULL CHECK(json_valid(working_days_json) AND json_type(working_days_json)='array' AND json_array_length(working_days_json) BETWEEN 1 AND 7),
 revision TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
