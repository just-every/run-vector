-- What a reviewed run read from its file, kept with the run so its
-- reconciliation report can compare it with the issues the run wrote.
CREATE TABLE vector_import_reports (
 job_id TEXT PRIMARY KEY,
 report_json TEXT NOT NULL CHECK(json_valid(report_json)),
 created_at TEXT NOT NULL
);
