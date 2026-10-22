import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {parseJsonc} from '@runeditrun/rer/jsonc';
import {fileRecords} from '@runeditrun/rer/modules/portability/files';
import {migrationReplay} from '@runeditrun/rer/modules/portability/migration-history';
import {insist} from '@runeditrun/rer/modules/portability/storage';
import {ledgerReader,archivedHistory,matchMigrationLedger} from '@runeditrun/rer/internal/modules/portability/ledgers.mjs';
import {restorableManifest} from '@runeditrun/rer/internal/modules/portability/bookkeeping.mjs';
import {migrationStatements} from '@runeditrun/rer/internal/modules/portability/migration-sql.mjs';
import {canonicalJson} from '@runeditrun/rer/internal/modules/portability/hash.mjs';

/** Locate authenticated history using this product's unchanged migration files.
 * No database bindings or filesystem writes precede complete input verification.
 */
export async function archiveUpgradePlan({root,path,journal,policy}) {
 let manifest,closing,journalClosing;const ledger=ledgerReader();
 for await(const record of fileRecords(path)) {
  ledger.add(record);
  if(record.kind==='manifest')manifest=record;
  if(record.kind==='closing')closing=record;
 }
 if(journal)for await(const record of fileRecords(journal))if(record.kind==='closing')journalClosing=record;
 insist(manifest.product===policy.product,'wrong_product',409);
 const config=parseJsonc(await readFile(join(root,'wrangler.jsonc'),'utf8'));
 const database=config.d1_databases.find(entry=>entry.binding==='DB');
 const directory=join(root,database.migrations_dir);
 const packaging=JSON.parse(await readFile(join(root,'scripts/delivery/base/packaging.json'),'utf8'));
 const prefix=packaging.artifact.specInputs.migrationPrefix??'';
 const {unstable_splitSqlQuery:split}=createRequire(join(root,'package.json'))('wrangler');
 const files=await Promise.all((await readdir(directory)).filter(name=>name.endsWith('.sql')).sort().map(async name=>{
  const bytes=await readFile(join(directory,name));
  return {name,sha256:createHash('sha256').update(bytes).digest('hex'),aliases:[prefix+name],statements:migrationStatements(bytes.toString('utf8'),split)};
 }));
 const source=await restorableManifest(manifest),history=archivedHistory(manifest,ledger.ledgers());
 const recorded=manifest.migrations?.map(name=>history?.find(entry=>entry.name===name)??{name})??history;
 const replay=migrationReplay(files,policy);
 let names;
 if(recorded)names=matchMigrationLedger(recorded,files);
 else {
  // Without a ledger, two matching schemas cannot distinguish a data-only
  // migration already applied at the source from one still needing execution.
  const matches=[];
  for(let count=0;count<=files.length;count++) {
   const candidate=files.slice(0,count).map(file=>file.name);
   if(await replay.schemaAfter(candidate)===source.schema)matches.push(candidate);
  }
  insist(matches.length===1,'archive_migration_history_required',409);[names]=matches;
 }
 insist(new Set(names).size===names.length && names.every((name,index)=>files[index]?.name===name),'archive_migration_order',409);
 insist(await replay.schemaAfter(names)===source.schema,'schema_mismatch',409);
 // Apply current secrecy requirements only to columns that existed at the
 // proven source schema. The archive cannot select its own redactions: its
 // authenticated inventory must exactly equal this projection, and Base's
 // historical import still checks every table and column against real D1.
 const sourceSecretColumns=Object.fromEntries(Object.entries(policy.secretColumns??{}).flatMap(([name,columns])=>{
  const table=source.tables.find(table=>table.name===name);
  const present=columns.filter(column=>table?.columns.some(entry=>entry.name===column));
  return table && (present.length || !columns.length)?[[name,present]]:[];
 }));
 insist(canonicalJson(source.excludedColumns)===canonicalJson(sourceSecretColumns),'secret_inventory',409);
 const currentSchema=await replay.schemaAfter(files.map(file=>file.name));
 const configuration=Object.fromEntries(['name','compatibility_date','compatibility_flags','d1_databases','r2_buckets'].filter(key=>config[key]!==undefined).map(key=>[key,config[key]]));
 return {needed:names.length<files.length,sourceCount:names.length,sourceSchema:source.schema,currentSchema,prefix,sourceSecretColumns,
  archiveHash:closing.archiveHash,journalArchiveHash:journalClosing?.archiveHash,files:files.map(({name,sha256})=>({name,sha256})),
  configuration};
}
