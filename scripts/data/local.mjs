import { remoteTransfer } from './remote.mjs';
import { localPortability } from '../base-cli/cli/portability.mjs';
import { portabilityPolicy } from '../../src/core/features/data/archive-policy.mjs';
import { guardLocalState } from '../installer/state.mjs';
const transport=localPortability({database:'vector-local',buckets:{FILES:'FILES'},policy:portabilityPolicy,transient:['sessions and sign-in links','development outbox','private settings','destination restore access and effect review']});
async function guarded(context,verb){
 if(context.target==='remote')return remoteTransfer(context,verb);
 await guardLocalState(context);
 const env={...process.env,RER_LOCAL_OPERATION:context.operationToken,WRANGLER_SEND_METRICS:'false'};
 await context.store.run('Preparing archive schema','pnpm',['exec','wrangler','d1','migrations','apply','vector-local','--local','--persist-to','.wrangler/state','--config','wrangler.jsonc'],{cwd:context.root,signal:context.signal,env});
 await context.store.run('Checking archive inventory and live attachments',process.execPath,['scripts/data/preflight.mjs'],{cwd:context.root,signal:context.signal,env});
 return transport[verb](context);
}
export const portability={remote:true,export:context=>guarded(context,'export'),import:context=>guarded(context,'import')};
