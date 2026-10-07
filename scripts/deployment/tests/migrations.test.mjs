import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { validateMigrations, migrate } from '../../../vendor/base/deploy-kit/migrations.mjs';
import { hash } from '../../../vendor/base/deploy-kit/validation.mjs';
import { cloudflare } from '../../../vendor/base/deploy-kit/provider.mjs';
import { providerFixture } from '../../../vendor/base/deploy-kit/tests/provider-fixture.mjs';

const migration = sql => ({ name: '0001_security.sql', sql, sha256: hash(sql) });
const validate = sql => validateMigrations([migration(sql)]);
const trigger = `CREATE TRIGGER example AFTER INSERT ON notes BEGIN
  UPDATE notes SET body = CASE WHEN NEW.body = 'END; BEGIN' THEN
    CASE WHEN NEW.id > 0 THEN 'COMMIT' ELSE 'ROLLBACK' END ELSE 'VACUUM' END WHERE id = NEW.id;
  SELECT 'it''s BEGIN; END;', "END", [BEGIN], \`COMMIT\` FROM notes;
END;`;

test('actual eleven immutable Vector migrations apply through the controller and repeat without writes', async t => {
  const dir = new URL('../../../migrations/core/', import.meta.url);
  const names = (await readdir(dir)).filter(name => name.endsWith('.sql')).sort();
  assert.equal(names.length, 11);
  const migrations = await Promise.all(names.map(async name => {
    const sql = await readFile(new URL(name, dir), 'utf8');
    return { name, sql, sha256: hash(sql) };
  }));
  assert.doesNotThrow(() => validateMigrations(migrations));
  const fixture = providerFixture(); t.after(() => fixture.close());
  const api = cloudflare(fixture);
  const database = await api.request('/d1/database', { method: 'POST', body: { name: 'vector-migration-proof' } });
  assert.deepEqual((await migrate(api, database.uuid, migrations)).applied, names);
  const db = fixture.state.databases[0].db;
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger'").get().n, 5);
  db.exec(`INSERT INTO oa_operators VALUES ('owner', 'owner@example.test', 'Owner', 'owner', 'active', 1, 0)`);
  assert.throws(() => db.exec("DELETE FROM oa_operators WHERE id='owner'"), /last_owner/);
  assert.throws(() => db.exec("UPDATE oa_operators SET status='inactive' WHERE id='owner'"), /last_owner/);
  const writes = fixture.state.writes.length;
  assert.deepEqual((await migrate(api, database.uuid, migrations)).applied, []);
  assert.equal(fixture.state.writes.length, writes);
  assert.equal(db.prepare("SELECT count(*) n FROM _rer_deploy_migrations WHERE state='applied'").get().n, 11);
});

test('trigger delimiters, nested CASE, quoted tokens, comments and multiple statements execute in SQLite', t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const sql = `-- BEGIN; COMMIT; END;\nCREATE TABLE notes(id INTEGER, body TEXT, "END", [BEGIN], \`COMMIT\`);
    /* ROLLBACK; SAVEPOINT x; */ ${trigger}
    CREATE TEMPORARY TRIGGER second AFTER UPDATE ON notes BEGIN SELECT CASE WHEN 1 THEN 'END' END; END;
    INSERT INTO notes(id,body) VALUES(1,'END; BEGIN');`;
  assert.doesNotThrow(() => validate(sql));
  db.exec('BEGIN'); db.exec(sql); db.exec('COMMIT');
  assert.equal(db.prepare('SELECT body FROM notes').get().body, 'COMMIT');
  assert.doesNotThrow(() => validate(trigger.slice(0, -1)));
});

const controls = ['BEGIN', 'BEGIN IMMEDIATE', 'BEGIN EXCLUSIVE TRANSACTION', 'COMMIT', 'END',
  'END TRANSACTION', 'ROLLBACK', 'ROLLBACK TO SAVEPOINT x', 'SAVEPOINT x', 'RELEASE SAVEPOINT x',
  "ATTACH DATABASE ':memory:' AS other", 'DETACH DATABASE other', "VACUUM INTO 'copy.db'"];
for (const control of controls) {
  test(`rejects ${control} before/after triggers and concealed by comments or string contents`, () => {
    const forms = [control, `/* BEGIN; END; */ ${control.toLowerCase()};`,
      `SELECT 'CREATE TRIGGER fake BEGIN; END;'; ${control};`, `${trigger}\n-- BEGIN fake\n${control};`,
      `${control}; ${trigger}`, `CREATE TRIGGER invalid AFTER INSERT ON notes BEGIN ${control}; END;`];
    for (const sql of forms) assert.throws(() => validate(sql), /unsafe-migration-control/, sql);
  });
}

test('comment-separated trigger headers and escaped quoted identifiers preserve SQLite token boundaries', t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const sql = `CREATE TABLE notes(id, "BE""GIN", \`CO\`\`MMIT\`);
    CREATE /* BEGIN; */ TEMP /* END; */ TRIGGER "BEGIN" AFTER INSERT ON notes
    WHEN CASE WHEN NEW.id = 1 THEN 1 ELSE 0 END
    BEGIN SELECT 'COMMIT; END;', "BE""GIN", \`CO\`\`MMIT\` FROM notes; END;
    INSERT INTO notes(id) VALUES(1); -- END; COMMIT;`;
  assert.doesNotThrow(() => validate(sql));
  db.exec('BEGIN'); db.exec(sql); db.exec('COMMIT');
  assert.equal(db.prepare('SELECT count(*) n FROM notes').get().n, 1);
});

test('both controller ledgers stay inaccessible through all SQLite identifier quoting forms', () => {
  for (const table of ['_rer_deploy_migrations', 'd1_migrations']) {
    for (const name of [table, `"${table.toUpperCase()}"`, `'${table}'`, `[${table}]`, `\`${table}\``]) {
      for (const sql of [`DELETE FROM main.${name};`, `${trigger} DROP TABLE ${name};`,
        `CREATE TRIGGER attack AFTER INSERT ON notes BEGIN DELETE FROM ${name}; END;`]) {
        assert.throws(() => validate(sql), /unsafe-migration-control/, sql);
      }
    }
  }
});

test('malformed delimiters cannot hide controls or swallow the appended ledger update', () => {
  for (const sql of ["SELECT 'open", 'SELECT "open', 'SELECT `open', 'SELECT [open', 'SELECT 1; /* open',
    'SELECT 1;\0COMMIT;', 'CREATE TRIGGER t AFTER INSERT ON notes;',
    'CREATE TRIGGER t AFTER INSERT ON notes BEGIN SELECT 1;',
    'CREATE TRIGGER t AFTER INSERT ON notes BEGIN SELECT CASE WHEN 1 THEN 2; END;',
    `${trigger.slice(0, -1)} COMMIT;`, 'CREATE TABLE t(id); BEGIN; SELECT CASE WHEN 1 THEN 2 END;',
    "SELECT 'escaped''; BEGIN'; COMMIT;", 'CREATE TRIGGER t AFTER INSERT ON notes BEGIN SELECT 1; END; END;',
    'SELECT (1;', 'SELECT 1);']) assert.throws(() => validate(sql), /unsafe-migration-control/, sql);
});

test('unsafe appended controls are rejected before any provider access', async () => {
  let calls = 0;
  const api = { request() { calls++; throw Error('unexpected-provider-call'); } };
  await assert.rejects(migrate(api, 'unused', [migration(`${trigger} COMMIT;`)]), /unsafe-migration-control/);
  assert.equal(calls, 0);
});
