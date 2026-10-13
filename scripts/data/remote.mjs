import { main } from '../base-cli/modules/portability/cli.mjs';
import { lstat } from 'node:fs/promises';
export async function remoteTransfer(context,direction){
 if(!context.origin||!context.sessionFile)throw Error('An authenticated origin and owner-only session file are required.');
 const info=await lstat(context.sessionFile);if(!info.isFile()||(info.mode&0o077))throw Error('Use a regular session file with mode 0600.');
 await main([direction,'--origin',context.origin,'--session-file',context.sessionFile,direction==='export'?'--out':'--from',context.path]);
 return {target:'remote',operation:direction,status:'complete'};
}
