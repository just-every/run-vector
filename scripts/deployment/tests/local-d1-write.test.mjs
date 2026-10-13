import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { writeLocalD1 } from "../../../tests/e2e/local-d1-write.mjs";
import { readLocalD1 } from "../../../tests/e2e/local-d1-read.mjs";

function fixture(t) {
  const scratch = resolve(".artifacts/verification/native-fixture-tests");
  mkdirSync(scratch, { recursive: true });
  const state = mkdtempSync(resolve(scratch, "state-"));
  const directory = resolve(state, "v3/d1/miniflare-D1DatabaseObject");
  mkdirSync(directory, { recursive: true });
  const path = resolve(directory, "a".repeat(64) + ".sqlite");
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE records(id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO records VALUES(1,'before'),(2,'second');
    CREATE TABLE children(parent_id INTEGER REFERENCES records(id) ON DELETE CASCADE);
    INSERT INTO children VALUES(1);`);
  const metadata = new DatabaseSync(resolve(directory, "metadata.sqlite"));
  metadata.exec("CREATE TABLE sentinel(value); INSERT INTO sentinel VALUES(91)");
  metadata.close();
  t.after(() => { db.close(); rmSync(state, { recursive: true, force: true }); });
  const rows = () => db.prepare("SELECT id,value FROM records ORDER BY id").all().map(row => ({ ...row }));
  return { state, directory, db, rows };
}

test("native fixture executes complete scripts with quoted and trigger semicolons", t => {
  const { state, db, rows } = fixture(t);
  writeLocalD1(state, `CREATE TABLE audit(value TEXT);
    CREATE TRIGGER record_update AFTER UPDATE ON records BEGIN
      INSERT INTO audit VALUES('trigger; literal');
      INSERT INTO audit VALUES(NEW.value);
    END;
    -- comment; remains SQL
    UPDATE records SET value='first; literal' WHERE id=1;
    UPDATE records SET value='second changed' WHERE id=2;`);
  assert.deepEqual(rows(), [{ id: 1, value: "first; literal" }, { id: 2, value: "second changed" }]);
  assert.deepEqual(db.prepare("SELECT value FROM audit").all().map(row => row.value),
    ["trigger; literal", "first; literal", "trigger; literal", "second changed"]);
});

test("native fixture rolls back trailing SQL and uniqueness errors and releases locks", t => {
  const { state, db, rows } = fixture(t);
  const before = rows();
  assert.throws(() => writeLocalD1(state, "UPDATE records SET value='partial'; INSERT INTO missing VALUES(1)"), /no such table/);
  assert.deepEqual(rows(), before);
  assert.throws(() => writeLocalD1(state, "UPDATE records SET value='partial'; INSERT INTO records VALUES(1,'duplicate')"), /UNIQUE constraint/);
  assert.deepEqual(rows(), before);
  db.exec("BEGIN IMMEDIATE; ROLLBACK");
  writeLocalD1(state, "UPDATE records SET value='recovered' WHERE id=1");
  assert.equal(rows()[0].value, "recovered");
});

test("native fixture enforces foreign keys, commit failures and cascades", t => {
  const { state, db, rows } = fixture(t);
  assert.throws(() => writeLocalD1(state, "UPDATE records SET value='partial'; INSERT INTO children VALUES(999)"), /FOREIGN KEY constraint/);
  assert.equal(rows()[0].value, "before");
  db.exec("CREATE TABLE deferred_children(parent_id INTEGER REFERENCES records(id) DEFERRABLE INITIALLY DEFERRED)");
  assert.throws(() => writeLocalD1(state, "UPDATE records SET value='partial'; INSERT INTO deferred_children VALUES(999)"), /FOREIGN KEY constraint/);
  assert.equal(rows()[0].value, "before");
  assert.equal(db.prepare("SELECT count(*) n FROM deferred_children").get().n, 0);
  db.exec("BEGIN IMMEDIATE; ROLLBACK");
  writeLocalD1(state, "DELETE FROM records WHERE id=1");
  assert.equal(db.prepare("SELECT count(*) n FROM children").get().n, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("native fixture reads and writes atomically while an existing WAL snapshot stays held", t => {
  const { state, db, rows } = fixture(t);
  const before = rows();
  db.exec("BEGIN");
  assert.deepEqual(rows(), before);
  try {
    writeLocalD1(state, "UPDATE records SET value=(SELECT value FROM records WHERE id=2)||'; changed' WHERE id=1; UPDATE records SET value='latest' WHERE id=2");
    assert.deepEqual(rows(), before, "reader retains its original WAL snapshot");
    assert.deepEqual(readLocalD1(state, "SELECT id,value FROM records ORDER BY id").map(row => ({ ...row })),
      [{ id: 1, value: "second; changed" }, { id: 2, value: "latest" }]);
  } finally { db.exec("ROLLBACK"); }
  assert.deepEqual(rows(), [{ id: 1, value: "second; changed" }, { id: 2, value: "latest" }]);
});

test("native fixture reports a held write lock within five seconds and closes its connection", t => {
  const { state, db, rows } = fixture(t);
  db.exec("BEGIN IMMEDIATE");
  const started = performance.now();
  try {
    assert.throws(() => writeLocalD1(state, "UPDATE records SET value='must not commit'"), error => error.errcode === 5);
    assert.ok(performance.now() - started < 5000, "native lock failure stays within the five-second budget");
  } finally { db.exec("ROLLBACK"); }
  assert.equal(rows()[0].value, "before");
  db.exec("BEGIN EXCLUSIVE; ROLLBACK");
  writeLocalD1(state, "UPDATE records SET value='after lock' WHERE id=1");
  assert.equal(rows()[0].value, "after lock");
});

test("native fixture refuses missing and ambiguous stores and leaves metadata untouched", t => {
  const { state, directory, rows } = fixture(t);
  const missing = resolve(state, "missing");
  assert.throws(() => writeLocalD1(missing, "CREATE TABLE accidental(id)"), /ENOENT/);
  const empty = resolve(state, "empty");
  mkdirSync(resolve(empty, "v3/d1/miniflare-D1DatabaseObject"), { recursive: true });
  assert.throws(() => writeLocalD1(empty, "CREATE TABLE accidental(id)"), /exactly one/);
  assert.deepEqual(readdirSync(resolve(empty, "v3/d1/miniflare-D1DatabaseObject")), []);
  new DatabaseSync(resolve(directory, "b".repeat(64) + ".sqlite")).close();
  assert.throws(() => writeLocalD1(state, "UPDATE records SET value='ambiguous'"), /exactly one/);
  assert.equal(rows()[0].value, "before");
  const metadata = new DatabaseSync(resolve(directory, "metadata.sqlite"), { readOnly: true });
  try { assert.equal(metadata.prepare("SELECT value FROM sentinel").get().value, 91); }
  finally { metadata.close(); }
});

test("native select inspection preserves rows and remains read-only", t => {
  const { state, db } = fixture(t);
  const query = "SELECT id,value,NULL AS absent FROM records ORDER BY id DESC";
  assert.deepEqual(readLocalD1(state, query), db.prepare(query).all());
  assert.throws(() => readLocalD1(state, "DELETE FROM records"), /readonly/);
  assert.equal(readLocalD1(state, "SELECT count(*) n FROM records")[0].n, 2);
});
