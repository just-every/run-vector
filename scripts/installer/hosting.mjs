import {parseAddress} from '../../vendor/base/mail/src/core/validation.mjs';
import {validatePublicConfiguration,validateSuppliedSecrets} from '../deployment/input-validation.mjs';
import declaration from '../../deploy.json' with {type:'json'};
import { prepareSettings } from '@runeditrun/rer/adapter-settings';
import { writePrivateFile, privateDirectory } from '@runeditrun/rer/private-files';
import { publicNames } from './definition.mjs';
import { join } from 'node:path';
export const hostingDeclaration = '.rer/deploy/declaration.json';
export const hostingSecrets = './.rer/deploy/secrets.env';
export async function prepareHosting(context, env) {
 const mailOff = env.MAIL_PROVIDER === 'none';
 const names = mailOff ? publicNames.filter(key => key !== 'MAIL_FROM') : publicNames;
 const missing=names.filter(key=>typeof env[key]!=='string'||!env[key].trim());
 if (missing.length) {context.store.report(`Missing ${missing.join(', ')}. See DEPLOY.md.`);throw context.fail('deploy');}
 validatePublicConfiguration(env, names);
 const mailKey = mailOff ? undefined : env.MAIL_API_KEY ?? env.SENDGRID_API_KEY;
 validateSuppliedSecrets({SESSION_SECRET:env.SESSION_SECRET,MAIL_API_KEY:mailKey});
 const secretContext={...context};
 await prepareSettings(secretContext,{secrets:{file:hostingSecrets,generate:env.SESSION_SECRET?[]:['SESSION_SECRET'],values:{SENDGRID_API_KEY:mailKey,SESSION_SECRET:env.SESSION_SECRET}}});
 await privateDirectory(context.root,['.rer','deploy']);
 const vars = { ...declaration.vars, ...Object.fromEntries(names.map(name => [name, env[name]])),
  ...(mailOff ? { MAIL_PROVIDER: 'none' } : { MAIL_FROM: parseAddress(env.MAIL_FROM).email }),
 };
 await writePrivateFile(join(context.root,hostingDeclaration),JSON.stringify({...declaration,vars},null,2)+'\n');
 context.store.report?.(`Owner secrets are kept in ${hostingSecrets}; preserve this file and .rer/deploy state.`);
 return secretContext.vars;
}
// Vector owns validation and secret custody; the package owns deployment and health.
export const deploy = Object.assign(async context => {
 const { ownerDeploy } = await import('@runeditrun/rer/deploy');
 const { adapter: local } = await import('./local.mjs');
 // Keep Base in charge of claiming the token it uploads and retiring it.
 if (!context.options.dryRun) {
  const prepared = await prepareHosting({ ...context, fail: () => Error('Deployment inputs missing') }, process.env);
  context.store.addSecrets(Object.values(prepared));
 }
 // The pinned CLI overlays public mail inputs from process.env during its
 // preflight, so normalizing only declaration.vars does not reach that check.
 const sender = process.env.MAIL_FROM;
 try {
  if (sender && process.env.MAIL_PROVIDER !== 'none') process.env.MAIL_FROM = parseAddress(sender).email;
  return await ownerDeploy(context.options.dryRun ? 'deploy.json' : hostingDeclaration, local)({
   ...context, options: { ...context.options, ...(context.options.dryRun ? {} : { envFile: hostingSecrets }) },
  });
 } finally {
  if (sender === undefined) delete process.env.MAIL_FROM;
  else process.env.MAIL_FROM = sender;
 }
}, { declaration: 'deploy.json', managesHostedOwner: true });
