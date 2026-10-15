import {parseAddress} from '../../vendor/base/mail/src/core/validation.mjs';
import {validatePublicConfiguration,validateSuppliedSecrets} from '../deployment/input-validation.mjs';
import declaration from '../../deploy.json' with {type:'json'};
import { prepareSettings } from '@runeditrun/rer/adapter-settings';
import { writePrivateFile, privateDirectory } from '@runeditrun/rer/private-files';
import { publicNames } from './definition.mjs';
import { join } from 'node:path';
export const hostingDeclaration = '.rer/deploy/declaration.json';
export const hostingSecrets = '.rer/deploy/secrets.env';
export async function prepareHosting(context, env) {
 const missing=publicNames.filter(key=>typeof env[key]!=='string'||!env[key].trim());
 if (missing.length) {context.store.report(`Missing ${missing.join(', ')}. See DEPLOY.md.`);throw context.fail('deploy');}
 validatePublicConfiguration(env);
 const mailKey = env.MAIL_API_KEY ?? env.SENDGRID_API_KEY;
 validateSuppliedSecrets({SESSION_SECRET:env.SESSION_SECRET,MAIL_API_KEY:mailKey});
 const secretContext={...context};
 await prepareSettings(secretContext,{secrets:{file:hostingSecrets,generate:env.SESSION_SECRET?[]:['SESSION_SECRET'],values:{SENDGRID_API_KEY:mailKey,SESSION_SECRET:env.SESSION_SECRET}}});
 await privateDirectory(context.root,['.rer','deploy']);
 const secrets=declaration.secrets.filter(item=>item.binding!=='MAIL_API_KEY'||secretContext.vars.SENDGRID_API_KEY);
 await writePrivateFile(join(context.root,hostingDeclaration),JSON.stringify({...declaration,secrets,vars:{...declaration.vars,...Object.fromEntries(publicNames.map(name=>[name,env[name]])),MAIL_FROM:parseAddress(env.MAIL_FROM).email}},null,2)+'\n');
 context.store.report?.(`Owner secrets are kept in ${hostingSecrets}; preserve this file and .rer/deploy state.`);
 return secretContext.vars;
}
// Vector owns validation and secret custody; the package owns deployment and health.
export const deploy = Object.assign(async context => {
 const { ownerDeploy } = await import('@runeditrun/rer/deploy');
 const { adapter: local } = await import('./local.mjs');
 // Keep Base in charge of claiming the token it uploads and retiring it.
 if (context.options.dryRun) return ownerDeploy('deploy.json', local)(context);
 const prepared = await prepareHosting({ ...context, fail: () => Error('Deployment inputs missing') }, process.env);
 context.store.addSecrets(Object.values(prepared));
 return ownerDeploy(hostingDeclaration, local)({ ...context, options: { ...context.options, envFile: hostingSecrets } });
}, { declaration: 'deploy.json', managesHostedOwner: true });
