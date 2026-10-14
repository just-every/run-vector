import {validatePublicConfiguration,validateSuppliedSecrets} from '../deployment/input-validation.mjs';
import declaration from '../../deploy.json' with {type:'json'};
import { prepareSettings, readSettings } from '@runeditrun/rer/adapter-settings';
import { writePrivateFile, privateDirectory } from '@runeditrun/rer/private-files';
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
// Vector owns validation and secret custody; the package owns deployment and health.
export const deploy = Object.assign(async context => {
 const { ownerDeploy } = await import('@runeditrun/rer/deploy');
 const { adapter: local } = await import('./local.mjs');
 // The owner is the configured FIRST_OWNER_EMAIL, who signs in by email; Vector serves no /auth/bootstrap, so a hosted deploy has no setup-token claim to run.
 const adapter = { ...local, hooks: { ...local.hooks, owner: undefined } };
 if (context.options.dryRun) return ownerDeploy('deploy.json', adapter)(context);
 const prepared = await prepareHosting({ ...context, fail: () => Error('Deployment inputs missing') }, process.env);
 context.store.addSecrets(Object.values(prepared));
 return ownerDeploy(hostingDeclaration, adapter)({ ...context, options: { ...context.options, envFile: hostingSecrets } });
}, { declaration: 'deploy.json', managesHostedOwner: true });
