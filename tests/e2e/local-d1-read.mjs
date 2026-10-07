import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

// Inspect the actual native D1 store without launching a second workerd owner.
// metadata.sqlite is Miniflare's routing ledger, not the application's database.
export function readLocalD1(state, query) {
  const directory=resolve(state,'v3/d1/miniflare-D1DatabaseObject');
  const files=readdirSync(directory).filter(name=>/^[a-f0-9]{64}\.sqlite$/.test(name));
  assert.equal(files.length,1,'Expected exactly one application D1 store');
  const database=new DatabaseSync(resolve(directory,files[0]),{readOnly:true});
  try { return database.prepare(query).all(); }
  finally { database.close(); }
}
