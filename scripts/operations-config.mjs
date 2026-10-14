import { controllerValidators } from './deployment/controller-inputs.mjs';
import { publicValidators, secretValidators, invalidConfigurationNames } from './deployment/input-validation.mjs';
import { readSettings } from '@runeditrun/rer/adapter-settings';
import { publicNames, settings, localRequired, localValidators } from './installer/definition.mjs';
export const hostedInputs=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','APP_ORIGIN','SESSION_SECRET','SENDGRID_API_KEY',...publicNames];
export const artifactInputs=['CF_THROWAWAY_ACCOUNT_ID','CF_THROWAWAY_API_TOKEN','RER_DEPLOY_ARTIFACT','RER_DEPLOY_ARTIFACT_SHA256','RER_DEPLOY_SOURCE_SHA','RER_DEPLOY_RUN_ID','RER_DEPLOY_RUN_ATTEMPT','RER_DEPLOY_RECEIPT','RER_DEPLOY_PLAN','SESSION_SECRET','MAIL_API_KEY'];
export const environmentSources=Object.fromEntries([...new Set([...hostedInputs,...artifactInputs])].map(name=>[name,name.startsWith('RER_')||name.startsWith('CF_THROWAWAY_')?'DEPLOY.md artifact controller custody and reviewed plan':'DEPLOY.md owner account inputs and private installation settings']));
export async function configurationReport(env={},root=process.cwd()) {
 const mode=env.VECTOR_OPERATION_MODE??'local';
 if(!['local','hosted','artifact'].includes(mode)) return {ok:false,mode:'unsupported',missing:[],invalid:['VECTOR_OPERATION_MODE'],guidance:'Choose local, hosted or artifact mode in OPERATIONS.md.'};
 if(mode==='local') {
  try {
   const {values,text}=await readSettings(root,settings);
   if(text===undefined)throw Error('missing settings');
   const missing=localRequired.filter(key=>typeof values[key]!=='string'||!values[key].trim());
   const invalid=invalidConfigurationNames(values,localValidators);
   return {ok:missing.length===0&&invalid.length===0,mode,missing,invalid,sources:Object.fromEntries([...missing,...invalid].map(key=>[key,'OPERATIONS.md shared local setup and private installation settings'])),guidance:'Run rer setup --owner-email EMAIL. See OPERATIONS.md.'};
  }
  catch {return {ok:false,mode,missing:['.dev.vars'],guidance:'Run rer setup --owner-email EMAIL. See OPERATIONS.md.'};}
 }
 const missing=(mode==='hosted'?hostedInputs:artifactInputs).filter(key=>typeof env[key]!=='string'||!env[key].trim());
 const invalid=[];
 if(mode==='hosted') {
  if(env.APP_ORIGIN) {try {const u=new URL(env.APP_ORIGIN);if(u.protocol!=='https:'||u.origin!==env.APP_ORIGIN) invalid.push('APP_ORIGIN');}catch {invalid.push('APP_ORIGIN');}}
  invalid.push(...invalidConfigurationNames(env,{CLOUDFLARE_ACCOUNT_ID:controllerValidators.CF_THROWAWAY_ACCOUNT_ID,CLOUDFLARE_API_TOKEN:controllerValidators.CF_THROWAWAY_API_TOKEN}));
  invalid.push(...invalidConfigurationNames(env,{...publicValidators,SESSION_SECRET:secretValidators.SESSION_SECRET,SENDGRID_API_KEY:secretValidators.MAIL_API_KEY}));
  if(env.MAIL_PROVIDER&&env.MAIL_PROVIDER!=='sendgrid')invalid.push('MAIL_PROVIDER');
 } else { invalid.push(...invalidConfigurationNames(env,controllerValidators)); }
 return {ok:missing.length===0&&invalid.length===0,mode,missing,invalid,sources:Object.fromEntries([...missing,...invalid].map(key=>[key,environmentSources[key]??'DEPLOY.md owner account inputs and private installation settings'])),mailBinding:mode==='hosted'?{input:'SENDGRID_API_KEY',binding:'MAIL_API_KEY'}:undefined};
}
export async function validateConfiguration(env) {if(!(await configurationReport(env)).ok)throw Error('Missing or invalid operation inputs; see OPERATIONS.md.');}
