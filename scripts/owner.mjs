import { loadInstallerSeed } from './base-onboarding/setup-manifest.mjs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createState } from './base-onboarding/state.mjs';
import { isolatedStore } from './installer-env.mjs';
import { prepareHosting, hostingDeclaration } from './installer/hosting.mjs';
import { createSeed } from './installer/seed.mjs';
import { installationFailure } from './base-onboarding/failures.mjs';
export async function ownerCommand(command,env=process.env,root=fileURLToPath(new URL('../',import.meta.url))) {
 const store=isolatedStore(await createState(root,await loadInstallerSeed(process.cwd(),createSeed())));
 const controller=new AbortController(),cancel=()=>controller.abort();store.setCommandSignal(controller.signal);
 process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
 try {
  const missing=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN'].filter(key=>!env[key]);
  if(missing.length) {store.report(`Missing ${missing.join(', ')}. See DEPLOY.md.`);throw installationFailure('command_failed',{step:'deploy'});}
  const context={root,store,fail:()=>installationFailure('command_failed',{step:'deploy'})};
  const secrets=await prepareHosting(context,env);
  store.addSecrets([env.CLOUDFLARE_API_TOKEN,...Object.values(secrets)]);
  await store.run('Owner account '+command,process.execPath,['vendor/base/deploy-kit/owner-cli.mjs',command,'--declaration',hostingDeclaration,'--environment','production'],{cwd:root,env:{...secrets,CLOUDFLARE_ACCOUNT_ID:env.CLOUDFLARE_ACCOUNT_ID,CLOUDFLARE_API_TOKEN:env.CLOUDFLARE_API_TOKEN}});
 } catch {store.report('Owner operation failed. See DEPLOY.md and the private installer log.');process.exitCode=1;}
 finally {await store.closeCommands();process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) await ownerCommand(process.argv[2]??'deploy');
