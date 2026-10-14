import { policy } from '@runeditrun/rer/modules/portability/catalogue';
import inventory from './archive-inventory.json' with {type:'json'};
const excluded=policy({product:'just-every/vector-projects'}).excludeTables;
const excludedTable=name=>excluded.some(pattern=>pattern.endsWith('%')?name.toLowerCase().startsWith(pattern.slice(0,-1)):name.toLowerCase()===pattern);
export async function validateArchiveInventory(db) {
 const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()).results;
 for(const {name} of tables) {
  if(!Object.hasOwn(inventory,name)&&excludedTable(name))continue;
  if(!Object.hasOwn(inventory,name))throw Error('unclassified_table');
  const columns=(await db.prepare('PRAGMA table_xinfo("'+name.replaceAll('"','""')+'")').all()).results.map(c=>c.name);
  if(JSON.stringify(columns)!==JSON.stringify(inventory[name]))throw Error('unclassified_column');
 }
 for(const name of Object.keys(inventory))if(!tables.some(row=>row.name===name))throw Error('missing_table');
 return tables.length;
}
export async function validateArchiveAttachments(db,bucket) {
 const live=(await db.prepare('SELECT blob_key,bytes FROM issue_files WHERE deleted_at IS NULL').all()).results;
 for(const file of live){const object=await bucket.head(file.blob_key);if(!object||object.size!==file.bytes)throw Error('attachment_reference');}
 return live.length;
}
