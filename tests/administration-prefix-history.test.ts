import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { contract } from "./contract.ts";

function previousDatabase() {
  const db = new DatabaseSync(":memory:");
  for (const name of readdirSync("migrations/core").filter((n) => n.endsWith(".sql")).sort().slice(0, 12))
    db.exec(readFileSync(join("migrations/core", name), "utf8"));
  db.exec(`INSERT INTO workspace_settings VALUES('workspace','Prefix history','UTC','2026-01-01','2026-01-01');
    INSERT INTO operators VALUES('operator','workspace','Owner','owner@history.test',NULL,'2026-01-01','2026-01-01');`);
  return db;
}
function addTeam(db: DatabaseSync, id: string, prefix: string) {
  db.prepare("INSERT INTO teams VALUES(?,'workspace',?,?,NULL,'2026-01-01','2026-01-01')").run(id, id, prefix);
  db.prepare("INSERT INTO workflow_statuses VALUES(?,?,'Backlog','backlog',0,'2026-01-01','2026-01-01')").run(id + "-status", id);
}
function upgrade(db: DatabaseSync) {
  db.exec(readFileSync("migrations/core/0013_workspace_administration.sql", "utf8"));
}
function rows(db: DatabaseSync, sql: string) {
  return db.prepare(sql).all().map((row) => ({ ...row }));
}

contract("BASE-OPS-002 TEAM-001 ISSUE-002", "legacy sequence-only and moved-away history remain frozen; prefix ledger backfills original prefixes without rewriting old rows", () => {
  const db = previousDatabase();
  try {
    for (const [id, prefix] of [["reserved", "OLD"], ["current", "HERE"], ["past", "PAST"], ["empty", "EMPTY"]]) addTeam(db, id, prefix);
    db.exec(`INSERT INTO team_issue_sequences VALUES('reserved',17,'2026-01-02');
      INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,created_at,updated_at)
        VALUES('issue','OLD-13','OLD',13,'current','Moved issue','current-status','none','2026-01-03','2026-01-05');
      INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,created_at,updated_at)
        VALUES('orphan-origin','RETIRED-41','RETIRED',41,'current','Prior origin','current-status','none','2026-01-03','2026-01-05');
      INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
        VALUES('move','issue','operator','issue.team_moved','{"teamId":"past"}','{"teamId":"current"}','2026-01-04','2026-01-04');`);
    const tables = rows(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const before = tables.map(({ name }) => ({ name, contents: rows(db, `SELECT * FROM "${name}" ORDER BY rowid`) }));
    upgrade(db);
    for (const table of before) assert.deepEqual(rows(db, `SELECT * FROM "${table.name}" ORDER BY rowid`), table.contents, String(table.name));
    assert.deepEqual(rows(db, "SELECT * FROM team_issue_history ORDER BY team_id"), [
      { team_id: "current", first_issue_at: "2026-01-03" },
      { team_id: "past", first_issue_at: "2026-01-04" },
      { team_id: "reserved", first_issue_at: "2026-01-02" },
    ]);
    assert.deepEqual(rows(db, "SELECT identifier_prefix,last_sequence FROM issue_prefix_sequences ORDER BY identifier_prefix"), [
      { identifier_prefix: "OLD", last_sequence: 17 },
      { identifier_prefix: "RETIRED", last_sequence: 41 },
    ]);
    for (const team of ["reserved", "current", "past"])
      assert.throws(() => db.prepare("UPDATE teams SET identifier_prefix='REPLACED' WHERE id=?").run(team), /team_prefix_frozen/);
    db.exec("UPDATE teams SET identifier_prefix='FRESH' WHERE id='empty'");
    // Previous application SQL remains usable with the additive ledger retained.
    db.exec("UPDATE teams SET name=name||' renamed',archived_at='2026-02-01' WHERE id='reserved'");
    db.exec("UPDATE team_issue_sequences SET last_sequence=last_sequence+1,updated_at='2026-02-01' WHERE team_id='reserved'");
    assert.equal(db.prepare("SELECT last_sequence FROM issue_prefix_sequences WHERE identifier_prefix='old'").get()!.last_sequence, 18);
    assert.equal(db.prepare("SELECT count(*) n FROM issue_prefix_sequences WHERE identifier_prefix='OLD'").get()!.n, 1);
    db.exec("DELETE FROM issues");
    for (const team of ["reserved", "current", "past"])
      assert.throws(() => db.prepare("UPDATE teams SET identifier_prefix='REPLACED' WHERE id=?").run(team), /team_prefix_frozen/);
    assert.equal(db.prepare("SELECT last_sequence FROM issue_prefix_sequences WHERE identifier_prefix='RETIRED'").get()!.last_sequence, 41);
    assert.deepEqual(rows(db, "PRAGMA foreign_key_check"), []);
  } finally { db.close(); }
});

contract("TEAM-001 ISSUE-002 BASE-OPS-002", "new reservations survive prefix reuse and transaction rollback without falsely creating issue history", () => {
  const db = previousDatabase();
  try {
    upgrade(db);
    addTeam(db, "fresh", "AB");
    db.exec("INSERT INTO team_issue_sequences VALUES('fresh',1,'2026-02-01')");
    db.exec("BEGIN");
    db.exec(`INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,created_at,updated_at)
      VALUES('rolled-back','AB-1','AB',1,'fresh','Never committed','fresh-status','none','2026-02-01','2026-02-01')`);
    assert.equal(db.prepare("SELECT count(*) n FROM team_issue_history").get()!.n, 1);
    db.exec("ROLLBACK");
    assert.equal(db.prepare("SELECT count(*) n FROM team_issue_history").get()!.n, 0);
    db.exec("UPDATE teams SET identifier_prefix='CD' WHERE id='fresh'");
    assert.equal(db.prepare("SELECT last_sequence FROM team_issue_sequences WHERE team_id='fresh'").get(), undefined);
    db.exec("INSERT INTO team_issue_sequences VALUES('fresh',1,'2026-02-02')");
    db.exec("UPDATE teams SET identifier_prefix='AB' WHERE id='fresh'");
    assert.equal(db.prepare("SELECT last_sequence FROM team_issue_sequences WHERE team_id='fresh'").get()!.last_sequence, 1);
    db.exec("UPDATE team_issue_sequences SET last_sequence=last_sequence+1 WHERE team_id='fresh'");
    db.exec("UPDATE teams SET identifier_prefix='EF' WHERE id='fresh'");
    addTeam(db, "reuse", "AB");
    assert.equal(db.prepare("SELECT last_sequence FROM team_issue_sequences WHERE team_id='reuse'").get()!.last_sequence, 2);
    assert.equal(db.prepare("SELECT count(*) n FROM team_issue_history").get()!.n, 0);
    assert.deepEqual(rows(db, "SELECT identifier_prefix,last_sequence FROM issue_prefix_sequences ORDER BY identifier_prefix"), [
      { identifier_prefix: "AB", last_sequence: 2 }, { identifier_prefix: "CD", last_sequence: 1 },
    ]);
    assert.deepEqual(rows(db, "PRAGMA foreign_key_check"), []);
  } finally { db.close(); }
});
