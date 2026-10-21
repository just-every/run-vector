import { remoteTransfer } from './remote.mjs';
import { localPortability } from '@runeditrun/rer/portability';
import { portabilityPolicy,archiveImportPolicy } from '../../src/core/features/data/archive-policy.mjs';
import { fileRecords } from '@runeditrun/rer/modules/portability/files';
import { readLegacyArchive } from '@runeditrun/rer/modules/portability/format';
import { PortabilityError } from '@runeditrun/rer/modules/portability';
import { RerError } from '@runeditrun/rer/errors';
import { guardLocalState } from '../installer/state.mjs';
const transport=policy=>localPortability({database:'vector-local',buckets:{FILES:'FILES'},policy,transient:['sessions and sign-in links','development outbox','private settings','destination restore access and effect review']});
// A database Platform's runner migrated keeps that runner as its sole authority: Wrangler cannot see its rer_migrations
// ledger and would apply every file again. Such a database must already hold every migration file, as rer's transfer
// checks again before it moves any data.
async function platformLedger(context,env){
 const child=context.store.spawn('Checking migration history',process.execPath,['scripts/data/ledger.mjs'],{cwd:context.root,signal:context.signal,env,stdio:['ignore','pipe','pipe','ipc']});
 let reply;child.on('message',message=>{reply=message;});
 await new Promise(resolve=>{child.once('exit',resolve);child.once('error',resolve);});
 await context.store.stop(child);
 if(reply?.refused)throw new RerError('restore_refused',`Local transfer refused (${reply.refused}): this database carries Run Edit Run Platform's migration ledger, and only Platform's runner may migrate it. Apply this version's migrations through Platform, then run the same command again.`,4);
 if(typeof reply?.platform!=='boolean')throw new RerError('transfer_failed','Local transfer failed: the migration history could not be read. Run the same command again.',1);
 return reply.platform;
}
async function guarded(context,verb){
 if(context.target==='remote')return remoteTransfer(context,verb);
 let policy=portabilityPolicy;
 if(verb==='import')try {
  for await(const record of fileRecords(context.path,context.legacyRecovery?readLegacyArchive:undefined))if(record.kind==='manifest')policy=archiveImportPolicy(record);
 }catch(error){
  if(error.message==='archive_json')throw new RerError('invalid_archive','Restore refused (archive_json): archive JSON is invalid.',2);
  if(error instanceof PortabilityError){
   const message=error.code==='legacy_archive_unverifiable'
    ? 'Restore refused (legacy_archive_unverifiable): version 1 metadata cannot be authenticated. Upgrade the original installation and re-export, or use rer import --legacy-v1 --input FILE --yes --acknowledge-unverified-metadata --output exports/recovered-v2.rer in an empty installation. See modules/portability/README.md#backup-only-v1-recovery.'
    : `Restore refused (${error.code}): archive verification failed.`;
   throw new RerError(error.status===409?'restore_refused':'transfer_failed',message,error.status===409?4:1);
  }
  throw error;
 }
 await guardLocalState(context);
 const env={...process.env,RER_LOCAL_OPERATION:context.operationToken,WRANGLER_SEND_METRICS:'false'};
 if(!await platformLedger(context,env))await context.store.run('Preparing archive schema','pnpm',['exec','wrangler','d1','migrations','apply','vector-local','--local','--persist-to','.wrangler/state','--config','wrangler.jsonc'],{cwd:context.root,signal:context.signal,env});
 await context.store.run('Checking archive inventory and live attachments',process.execPath,['scripts/data/preflight.mjs'],{cwd:context.root,signal:context.signal,env});
 return transport(policy)[verb](context);
}
export const portability={remote:true,export:context=>guarded(context,'export'),import:context=>guarded(context,'import')};
