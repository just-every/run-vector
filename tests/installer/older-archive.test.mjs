import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm,symlink,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {getPlatformProxy} from 'wrangler';
import {splitSqlStatements} from '../../scripts/delivery/base/sql-statements.mjs';
import {compareRetainedArchive} from './retained-archive.mjs';

// Run Edit Run Platform's runner records each deployment-spec migration in rer_migrations, in the same request as the
// file's statements (platform src/integrations/migration-batch.ts); its effect stands in for the hosted service here.
async function platformMigrations(root,db) {
 const {migrations}=JSON.parse(await readFile(join(root,'management/integration/deployment-spec.json'),'utf8'));
 await db.prepare('CREATE TABLE IF NOT EXISTS rer_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
 for(const migration of migrations)await db.batch([db.prepare('INSERT INTO rer_migrations(name,sha256) VALUES (?,?)').bind(migration.name,migration.sha256),...splitSqlStatements(migration.sql).map(sql=>db.prepare(sql))]);
}

test('[BASE-DATA-001 DATA-001] a backup from the listed version restores through rer import, with either migration ledger',async()=>{
 const source=process.cwd(),work=await mkdtemp(join(tmpdir(),'vector-retained-'));
 const fixture=resolve('tests/fixtures/archives/listed-version'),archive=join(work,'listed-version.rer');
 const run=(root,command,args)=>execFileSync(command,args,{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024,env:{...process.env,CI:'true'},stdio:'pipe'});
 try {
  // Keep the historical manifest readable in source; restore its original wire bytes.
  await writeFile(archive,Buffer.concat([Buffer.from(JSON.stringify(JSON.parse(await readFile(fixture+'.manifest.json','utf8')))+'\n'),await readFile(fixture+'.records.ndjson')]),{mode:0o600});
  for(const platform of [false,true]) {
   const root=join(work,platform?'platform':'native');
   run(source,'git',['clone','--quiet','--no-hardlinks',source,root]);
   await symlink(resolve('node_modules'),join(root,'node_modules'),'dir');
   const options={configPath:join(root,'wrangler.jsonc'),persist:{path:join(root,'.wrangler/state/v3')},remoteBindings:false};
   // A native destination is empty; import prepares its schema with Wrangler.
   if(platform) {
    const proxy=await getPlatformProxy(options);
    try {await platformMigrations(root,proxy.env.DB);}
    finally {await proxy.dispose();}
   }
   run(root,process.execPath,[join(root,'node_modules/@runeditrun/rer/bin/rer.mjs'),'import','--input',archive,'--yes']);
   // The restored installation backs up again through the same door.
   run(root,process.execPath,[join(root,'node_modules/@runeditrun/rer/bin/rer.mjs'),'export','--output',join(work,(platform?'platform':'native')+'.rer')]);
   const proxy=await getPlatformProxy(options);
   try {
    await compareRetainedArchive(archive,proxy.env,{auditActions:['archive.import.completed','archive.export.started','archive.export.completed']});
    // Platform's runner stays the database's only migration authority: Wrangler never adds its ledger beside it.
    const ledgers=(await proxy.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('rer_migrations','d1_migrations')").all()).results.map(row=>row.name);
    assert.deepEqual(ledgers,[platform?'rer_migrations':'d1_migrations']);
   } finally {await proxy.dispose();}
  }
 } finally {await rm(work,{recursive:true,force:true});}
});
