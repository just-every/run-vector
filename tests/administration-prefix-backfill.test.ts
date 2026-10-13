import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { contract } from "./contract.ts";

function previousDatabase() {
  const db = new DatabaseSync(":memory:");
  for (const name of readdirSync("migrations/core").filter((n) => n.endsWith(".sql")).sort().slice(0, 12))
    db.exec(readFileSync(join("migrations/core", name), "utf8"));
  db.exec(`INSERT INTO workspace_settings VALUES('workspace','History workspace','UTC','2026-01-01','2026-01-01');
    INSERT INTO operators VALUES('operator','workspace','Owner','owner@backfill.test',NULL,'2026-01-01','2026-01-01');`);
  return db;
}
function upgrade(db: DatabaseSync) {
  db.exec(readFileSync("migrations/core/0013_workspace_administration.sql", "utf8"));
}
function rows(db: DatabaseSync, sql: string) {
  return db.prepare(sql).all().map((row) => ({ ...row }));
}

contract("BASE-OPS-002 TEAM-001 ISSUE-012", "legacy movement backfill selects the earliest valid evidence and ignores malformed JSON and unknown teams", () => {
  const db = previousDatabase();
  try {
    for (const [id, prefix] of [["current", "NOW"], ["departed", "PAST"], ["arrived", "VISIT"], ["previousOnly", "PREV"], ["clean", "CLEAN"]])
      db.prepare("INSERT INTO teams VALUES(?,'workspace',?,?,NULL,'2026-01-01','2026-01-01')").run(id, id, prefix);
    db.exec(`INSERT INTO workflow_statuses VALUES('status','current','Backlog','backlog',0,'2026-01-01','2026-01-01');
      INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,created_at,updated_at)
        VALUES('issue','PAST-4','PAST',4,'current','Previously moved work','status','none','2026-01-01','2026-01-09');
      INSERT INTO team_issue_sequences VALUES('current',8,'2026-01-08'),('departed',4,'2026-01-02'),('arrived',2,'2026-01-06');`);
    const insert = db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      VALUES(?,'issue','operator',?,?,?,?,?)`);
    for (const [id, kind, previous, next, at] of [
      ["firstMove", "issue.team_moved", '{"teamId":"departed"}', '{"teamId":"arrived"}', "2026-01-03"],
      ["secondMove", "issue.team_moved", '{"teamId":"arrived"}', '{"teamId":"current"}', "2026-01-05"],
      ["invalidPrevious", "issue.team_moved", '{"teamId":"clean"', '{"teamId":"arrived"}', "2026-01-04"],
      ["invalidNext", "issue.team_moved", '{"teamId":"previousOnly"}', '{"teamId":"clean"', "2026-01-07"],
      ["unknownBoth", "issue.team_moved", '{"teamId":"unknownPrevious"}', '{"teamId":"unknownNext"}', "2025-01-01"],
      ["invalidBoth", "issue.team_moved", "not JSON", "{", "2025-01-01"],
      ["otherActivity", "issue.title_changed", '{"teamId":"clean"}', '{"teamId":"clean"}', "2025-01-01"],
      ["missingKeys", "issue.team_moved", "{}", "null", "2025-01-01"],
    ]) insert.run(id, kind, previous, next, at, at);
    const before = rows(db, "SELECT * FROM issue_activity ORDER BY id");
    upgrade(db);
    assert.deepEqual(rows(db, "SELECT * FROM issue_activity ORDER BY id"), before);
    assert.deepEqual(rows(db, "SELECT * FROM team_issue_history ORDER BY team_id"), [
      { team_id: "arrived", first_issue_at: "2026-01-03" },
      { team_id: "current", first_issue_at: "2026-01-01" },
      { team_id: "departed", first_issue_at: "2026-01-02" },
      { team_id: "previousOnly", first_issue_at: "2026-01-07" },
    ]);
    for (const team of ["arrived", "current", "departed", "previousOnly"])
      assert.throws(() => db.prepare("UPDATE teams SET identifier_prefix='CHANGED' WHERE id=?").run(team), /team_prefix_frozen/);
    db.exec("UPDATE teams SET identifier_prefix='FRESH' WHERE id='clean'");
    assert.deepEqual(rows(db, "PRAGMA foreign_key_check"), []);
  } finally { db.close(); }
});

contract("TEAM-001 ISSUE-002 BASE-OPS-002", "old sequence SQL preserves each workspace prefix high-water mark without creating issue history", () => {
  const db = previousDatabase();
  try {
    db.exec(`INSERT INTO workspace_settings VALUES('other','Other workspace','UTC','2026-01-01','2026-01-01');
      INSERT INTO teams VALUES('first','workspace','First team','AB',NULL,'2026-01-01','2026-01-01');
      INSERT INTO teams VALUES('second','other','Second team','AB',NULL,'2026-01-01','2026-01-01');`);
    upgrade(db);
    db.exec(`INSERT INTO team_issue_sequences VALUES('first',7,'2026-02-01'),('second',2,'2026-02-02');
      UPDATE team_issue_sequences SET last_sequence=9,updated_at='2026-02-03' WHERE team_id='first';
      UPDATE team_issue_sequences SET last_sequence=3,updated_at='2026-02-04' WHERE team_id='first';
      UPDATE team_issue_sequences SET last_sequence=9,updated_at='2026-02-05' WHERE team_id='first';`);
    assert.deepEqual(rows(db, "SELECT * FROM issue_prefix_sequences ORDER BY workspace_id"), [
      { workspace_id: "other", identifier_prefix: "AB", last_sequence: 2, updated_at: "2026-02-02" },
      { workspace_id: "workspace", identifier_prefix: "AB", last_sequence: 9, updated_at: "2026-02-03" },
    ]);
    assert.deepEqual(rows(db, "SELECT * FROM team_issue_history"), []);
    db.exec("UPDATE teams SET identifier_prefix='CD' WHERE id='first'");
    db.exec("INSERT INTO team_issue_sequences VALUES('first',1,'2026-02-06')");
    db.exec("UPDATE teams SET identifier_prefix='AB' WHERE id='first'");
    assert.equal(db.prepare("SELECT last_sequence FROM team_issue_sequences WHERE team_id='first'").get()!.last_sequence, 9);
    assert.equal(db.prepare("SELECT last_sequence FROM team_issue_sequences WHERE team_id='second'").get()!.last_sequence, 2);
    assert.deepEqual(rows(db, "SELECT * FROM team_issue_history"), []);
    assert.deepEqual(rows(db, "PRAGMA foreign_key_check"), []);
  } finally { db.close(); }
});
