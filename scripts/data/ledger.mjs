import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { parseJsonc } from '@runeditrun/rer/jsonc';
// Which runner migrates this installation's database. Platform's runner records each file it applies in rer_migrations,
// a ledger Wrangler cannot read: such a database is Platform's alone to migrate and must already hold every file here.
// Reported over IPC: {platform}, or {refused} with a symbolic code naming a migration file of this checkout.
const root=process.cwd(),config=parseJsonc(await readFile(join(root,'wrangler.jsonc'),'utf8'));
const directory=join(root,config.d1_databases.find(database=>database.binding==='DB').migrations_dir);
const {getPlatformProxy}=createRequire(join(root,'package.json'))('wrangler');
const proxy=await getPlatformProxy({configPath:join(root,'wrangler.jsonc'),persist:{path:join(root,'.wrangler/state/v3')},remoteBindings:false});
let reply;
try {
 const ledgers=(await proxy.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('rer_migrations','d1_migrations','_rer_deploy_migrations')").all()).results.map(row=>row.name);
 if(!ledgers.includes('rer_migrations'))reply={platform:false};
 else if(ledgers.length>1)reply={refused:'migration_ledger:multiple:rer_migrations'};
 else {
  // A file Platform applied in part is recorded as name#start-end until it completes.
  const applied=new Set((await proxy.env.DB.prepare("SELECT sha256 FROM rer_migrations WHERE instr(name,'#')=0").all()).results.map(row=>row.sha256));
  const files=(await readdir(directory)).filter(name=>name.endsWith('.sql')).sort();
  const hashes=await Promise.all(files.map(async name=>createHash('sha256').update(await readFile(join(directory,name))).digest('hex')));
  const pending=files.filter((name,index)=>!applied.has(hashes[index]));
  reply=pending.length?{refused:'migration_ledger:unapplied:'+pending[0]}:{platform:true};
 }
} finally {await proxy.dispose();}
await new Promise(resolve=>process.send(reply,resolve));
process.disconnect();
