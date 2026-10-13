import {validatePublicConfiguration,validateSuppliedSecrets} from '../deployment/input-validation.mjs';
import declaration from '../../deploy.json' with {type:'json'};
import { ownerAccountHosting } from '../base-onboarding/adapter-hosting.mjs';
import { prepareSettings, readSettings } from '../base-onboarding/adapter-settings.mjs';
import { writePrivateFile, privateDirectory } from '../base-onboarding/private-files.mjs';
import { publicNames } from './definition.mjs';
import { join } from 'node:path';
export const hostingDeclaration = '.rer/deploy/declaration.json';
export const hostingSecrets = '.rer/deploy/secrets.env';
export async function prepareHosting(context, env) {
 const missing=publicNames.filter(key=>typeof env[key]!=='string'||!env[key].trim());
 if (missing.length) {context.store.report(`Missing ${missing.join(', ')}. See DEPLOY.md.`);throw context.fail('deploy');}
 validatePublicConfiguration(env);
 validateSuppliedSecrets({SESSION_SECRET:env.SESSION_SECRET,MAIL_API_KEY:env.SENDGRID_API_KEY});
 const saved = await readSettings(context.root,{file:hostingSecrets});
 if (!env.SENDGRID_API_KEY && !saved.values.SENDGRID_API_KEY) {context.store.report('Missing SENDGRID_API_KEY. See DEPLOY.md.');throw context.fail('deploy');}
 const secretContext={...context};
 await prepareSettings(secretContext,{secrets:{file:hostingSecrets,generate:env.SESSION_SECRET?[]:['SESSION_SECRET'],values:{SENDGRID_API_KEY:env.SENDGRID_API_KEY,SESSION_SECRET:env.SESSION_SECRET}}});
 if (!secretContext.vars.SENDGRID_API_KEY) {context.store.report('Missing SENDGRID_API_KEY. See DEPLOY.md.');throw context.fail('deploy');}
 await privateDirectory(context.root,['.rer','deploy']);
 await writePrivateFile(join(context.root,hostingDeclaration),JSON.stringify({...declaration,vars:{...declaration.vars,...Object.fromEntries(publicNames.map(name=>[name,env[name]]))}},null,2)+'\n');
 context.store.report?.(`Owner secrets are kept in ${hostingSecrets}; preserve this file and .rer/deploy state.`);
 return secretContext.vars;
}
const installHosting = ownerAccountHosting({cli:'vendor/base/deploy-kit/owner-cli.mjs',declaration:hostingDeclaration,secrets:context=>context.hostSecrets});
export async function hosting(context) {
 if (context.input.target === 'remote') {
  if (context.input.MAIL_MODE !== 'sendgrid') throw context.fail('deploy');
  context.hostSecrets = await prepareHosting(context,{...context.vars,...context.input});
 }
 return installHosting(context);
}

// Public deploy uses the same owner declaration and secret custody as the installer.
export async function deploy(context) {
 const { ownerDeploy } = await import('../base-cli/cli/deploy.mjs');
 const { adapter } = await import('./local.mjs');
 if (context.options.dryRun) return ownerDeploy('deploy.json', adapter)(context);
 const prepared = await prepareHosting({ ...context, fail: () => Error('Deployment inputs missing') }, process.env);
 const { main } = await import('../../vendor/base/deploy-kit/owner-cli.mjs');
 await adapter.run(context.root, {}, context.store, () => {}, context.signal, { verb: 'build', operationToken: context.operationToken });
 const env = { ...prepared, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN };
 context.store.addSecrets(Object.values(prepared));
 const args = ['--declaration', hostingDeclaration, '--environment', context.options.environment ?? 'production'];
 const result = await main(['deploy', ...args], env, { cwd: context.root });
 await main(['health', ...args], env, { cwd: context.root });
 return { deployed: true, origin: result.origin };
}
