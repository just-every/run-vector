import { join } from 'node:path';
import { createRequire } from 'node:module';
import { validateArchiveInventory,validateArchiveAttachments } from '../../src/core/features/data/archive-inventory.mjs';
const root=process.cwd();
const {getPlatformProxy}=createRequire(join(root,'package.json'))('wrangler');
const proxy=await getPlatformProxy({configPath:join(root,'wrangler.jsonc'),persist:{path:join(root,'.wrangler/state/v3')},remoteBindings:false});
try {
 const schemaTables=await validateArchiveInventory(proxy.env.DB),liveAttachments=await validateArchiveAttachments(proxy.env.DB,proxy.env.FILES);
 console.log(JSON.stringify({schemaTables,liveAttachments}));
} catch(error){console.error(['unclassified_table','unclassified_column','missing_table','attachment_reference'].includes(error.message)?error.message:'archive_preflight_failed');process.exitCode=1;}
finally {await proxy.dispose();}
