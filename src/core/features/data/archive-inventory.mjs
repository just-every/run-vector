// 0100 changes only the subscription capture trigger; inventory columns and portable event history stay unchanged.
import { policy } from '@runeditrun/rer/modules/portability/catalogue';
import inventory from './archive-inventory.json' with {type:'json'};
const excluded=policy({product:'just-every/vector-projects'}).excludeTables;
const excludedTable=name=>excluded.some(pattern=>pattern.endsWith('%')?name.toLowerCase().startsWith(pattern.slice(0,-1)):name.toLowerCase()===pattern);
export async function validateArchiveInventory(db) {
 const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()).results;
 // Keep every schema check on every request, but execute the PRAGMAs in one
 // D1 batch instead of a network round trip for each classified table.
 const classified=[];
 for(const {name} of tables) {
  if(!Object.hasOwn(inventory,name)&&excludedTable(name))continue;
  if(!Object.hasOwn(inventory,name))throw Error('unclassified_table');
  classified.push(name);
 }
 const present=new Set(tables.map(row=>row.name));
 for(const name of Object.keys(inventory))if(!present.has(name))throw Error('missing_table');
 const schemas=await db.batch(classified.map(name=>db.prepare('PRAGMA table_xinfo("'+name.replaceAll('"','""')+'")')));
 for(let index=0;index<classified.length;index++) {
  const columns=schemas[index].results.map(column=>column.name);
  if(JSON.stringify(columns)!==JSON.stringify(inventory[classified[index]]))throw Error('unclassified_column');
 }
 return tables.length;
}
export async function validateArchiveAttachments(db,bucket) {
 const live=(await db.prepare('SELECT blob_key,bytes FROM issue_files WHERE deleted_at IS NULL').all()).results;
 for(const file of live){const object=await bucket.head(file.blob_key);if(!object||object.size!==file.bytes)throw Error('attachment_reference');}
 return live.length;
}
