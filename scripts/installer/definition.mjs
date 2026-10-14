import {publicValidators,secretValidators} from '../deployment/input-validation.mjs';
export const settings = { file: '.dev.vars', originKey:'APP_ORIGIN', keepExisting:true, values: ({input,origin}) => ({
 IDENTITY_PROVIDER:input.IDENTITY_PROVIDER, APP_ORIGIN:origin, MAIL_MODE:'local-outbox', MAIL_FROM:'Vector <signin@localhost.test>', SEED_SAMPLE_DATA:'false',
 FIRST_OWNER_EMAIL:input.FIRST_OWNER_EMAIL, FIRST_OWNER_NAME:input.FIRST_OWNER_NAME, WORKSPACE_NAME:input.WORKSPACE_NAME,
 WORKSPACE_TIMEZONE:input.WORKSPACE_TIMEZONE, DEFAULT_TEAM_NAME:input.DEFAULT_TEAM_NAME, DEFAULT_TEAM_PREFIX:input.DEFAULT_TEAM_PREFIX,
}) };
export const persist = '.wrangler/state';
export const config = 'wrangler.jsonc';
export const migrate = ['pnpm',['exec','wrangler','d1','migrations','apply','vector-local','--local','--persist-to',persist,'--config',config]];
export const publicNames = ['FIRST_OWNER_EMAIL','FIRST_OWNER_NAME','WORKSPACE_NAME','WORKSPACE_TIMEZONE','DEFAULT_TEAM_NAME','DEFAULT_TEAM_PREFIX','MAIL_FROM'];
export function configuredInput(env) {
 return Object.fromEntries(['email','displayName','workspace','timezone','team','prefix'].map((key,i)=>[key,env[publicNames[i]]]));
}
export const localRequired=[...publicNames,'APP_ORIGIN','SESSION_SECRET','MAIL_MODE'];
export const localValidators={...publicValidators,SESSION_SECRET:secretValidators.SESSION_SECRET,
 APP_ORIGIN(value){const url=new URL(value);if(url.origin!==value || url.hostname!=='127.0.0.1' || url.protocol!=='http:' || !url.port)throw Error('Invalid local origin');},
 MAIL_MODE(value){if(value!=='local-outbox')throw Error('Invalid local mail mode');},
};
export function validateSettings(values) {
 for (const key of [...publicNames.slice(0,6),'APP_ORIGIN','SESSION_SECRET']) if (!values[key]) throw Error(`Missing ${key}; run rer setup --owner-email EMAIL.`);
 try {for(const [key,validate] of Object.entries(localValidators))validate(values[key]);}
 catch {throw Error('Invalid local settings; run rer setup --owner-email EMAIL.');}
 return new URL(values.APP_ORIGIN);
}
