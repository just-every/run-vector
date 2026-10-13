import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Fixture-only access to the active Worker's native store; no second workerd.
export function writeLocalD1(state, script) {
  const directory = resolve(state, "v3/d1/miniflare-D1DatabaseObject");
  const files = readdirSync(directory).filter(name => /^[a-f0-9]{64}\.sqlite$/.test(name));
  assert.equal(files.length, 1, "Expected exactly one application D1 store");
  const database = new DatabaseSync(resolve(directory, files[0]), {
    enableForeignKeyConstraints: true,
    timeout: 1000,
  });
  try {
    // Reserve the write lock before a script can establish a read snapshot.
    database.exec("BEGIN IMMEDIATE");
    database.exec(script);
    database.exec("COMMIT");
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}
