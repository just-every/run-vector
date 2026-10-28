import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,chmod,symlink,rm} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {fileRecords} from '@runeditrun/rer/modules/portability/files';
import {RerError} from '@runeditrun/rer/errors';

async function planUpgrade(context,policy) {
 const worker=fileURLToPath(new URL('./archive-upgrade-worker.mjs',import.meta.url));
 const child=context.store.spawn('Verifying archive migration history',process.execPath,[worker,JSON.stringify({root:context.root,path:context.path,journal:context.journal,policy,acknowledgeUnverifiedSchemaObjects:context.acknowledgeUnverifiedSchemaObjects})],
  {cwd:context.root,signal:context.signal,env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe','ipc']});
 let reply;child.on('message',message=>{reply=message;});
 await new Promise(resolve=>{child.once('exit',resolve);child.once('error',resolve);});
 await context.store.stop(child);
 if(!reply?.ok)throw new RerError('restore_refused',`Archive upgrade refused (${reply?.reason??'archive_upgrade_plan_failed'}).`,4);
 return reply.plan;
}

async function migrationFiles(context,root,files,configuration) {
 const directory=configuration.d1_databases.find(entry=>entry.binding==='DB').migrations_dir;
 await mkdir(join(root,directory),{recursive:true,mode:0o700});
 for(const file of files) {
  const bytes=await readFile(join(context.root,directory,file.name));
  if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)
   throw new RerError('restore_refused','Archive upgrade refused (migration_file_changed).',4);
  await writeFile(join(root,directory,file.name),bytes,{mode:0o600});
 }
}

/** Restore at the source schema, then run the real forward migrations on the
 * restored rows. Both transfers use Base and real isolated local D1/R2 bindings;
 * the destination keeps its own migration runner and ledger throughout.
 */
export async function withArchiveUpgrade(context,policy,transport,restore) {
 // Acknowledged v1 recovery retains Base's separate unverified-metadata door.
 if(context.legacyRecovery)return restore(context,policy);
 const plan=await planUpgrade(context,policy);
 if(!plan.needed)return restore(context,policy);
 const root=await mkdtemp(join(tmpdir(),'vector-archive-upgrade-'));
 try {
  const config=Object.fromEntries(['name','compatibility_date','compatibility_flags','d1_databases','r2_buckets'].filter(key=>plan.configuration[key]!==undefined).map(key=>[key,plan.configuration[key]]));
  await writeFile(join(root,'wrangler.jsonc'),JSON.stringify(config),{mode:0o600});
  await copyFile(join(context.root,'package.json'),join(root,'package.json'));
  await chmod(join(root,'package.json'),0o600);
  await symlink(join(context.root,'node_modules'),join(root,'node_modules'),'dir');
  const original=join(root,'original.rer'),upgraded=join(root,'upgraded.rer');
  await copyFile(context.path,original);await chmod(original,0o600);
  let closing;
  for await(const record of fileRecords(original))if(record.kind==='closing')closing=record;
  if(closing.archiveHash!==plan.archiveHash)throw new RerError('restore_refused','Archive upgrade refused (archive_changed).',4);
  let journal;
  if(context.journal){
   journal=join(root,'journal.rer');await copyFile(context.journal,journal);await chmod(journal,0o600);
   for await(const record of fileRecords(journal))if(record.kind==='closing'&&record.archiveHash!==plan.journalArchiveHash)
    throw new RerError('restore_refused','Archive upgrade refused (journal_changed).',4);
  }
  await migrationFiles(context,root,plan.files.slice(0,plan.sourceCount),config);
  context.store.report('Restoring the verified archive in isolated resources, then applying unchanged forward product migrations.');
  const scratch={...context,root,path:original,journal};
  const historicalPolicy={...policy,secretColumns:plan.sourceSecretColumns,replaceableTables:plan.sourceReplaceableTables};
  const historical=await transport(historicalPolicy,{prefix:plan.prefix}).import(scratch);
  await migrationFiles(context,root,plan.files.slice(plan.sourceCount),config);
  // Keep the source's declared configuration inventory. No manifest or
  // authenticated source bytes are edited.
  await transport(policy).export({...scratch,path:upgraded,journal:undefined});
  // Scratch finalize merged the trusted later tombstones/epoch into its state;
  // Base export authenticates that complete journal in the converted manifest.
  // Passing the older journal again can reject a newer migrated checkpoint.
  const result=await restore({...context,path:upgraded,journal:undefined},policy);
  return {...result,...(historical.schemaUnverified?{schemaUnverified:historical.schemaUnverified}:{}),input:relative(context.root,context.path),upgraded:{fromSchema:plan.sourceSchema,toSchema:plan.currentSchema,migrations:plan.files.slice(plan.sourceCount).map(file=>file.name),sourceArchiveHash:plan.archiveHash}};
 } finally {await rm(root,{recursive:true,force:true});}
}
