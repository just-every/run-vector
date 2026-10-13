import {resolve} from 'node:path';
import {assert,hexId} from '../../vendor/base/deploy-kit/validation.mjs';
import {cloudflare} from '../../vendor/base/deploy-kit/provider.mjs';
import {secretValidators} from './input-validation.mjs';
export const controllerRequired=['CF_THROWAWAY_ACCOUNT_ID','CF_THROWAWAY_API_TOKEN','RER_DEPLOY_ARTIFACT','RER_DEPLOY_ARTIFACT_SHA256','RER_DEPLOY_SOURCE_SHA','RER_DEPLOY_RUN_ID','RER_DEPLOY_RUN_ATTEMPT','RER_DEPLOY_RECEIPT','RER_DEPLOY_PLAN'];
const absolute=value=>assert(typeof value==='string' && value===resolve(value),'input-path-must-be-absolute');
export const controllerValidators={
 CF_THROWAWAY_ACCOUNT_ID:value=>assert(hexId(value),'missing-or-invalid-CF_THROWAWAY_ACCOUNT_ID'),
 CF_THROWAWAY_API_TOKEN:value=>{cloudflare({accountId:'a'.repeat(32),token:value,fetch:()=>{throw Error('offline validation')}});},
 RER_DEPLOY_ARTIFACT:absolute,RER_DEPLOY_RECEIPT:absolute,RER_DEPLOY_PLAN:absolute,
 RER_DEPLOY_ARTIFACT_SHA256:value=>assert(typeof value==='string' && /^[a-f0-9]{64}$/.test(value),'missing-artifact-sha256'),
 RER_DEPLOY_SOURCE_SHA:value=>assert(typeof value==='string' && /^[a-f0-9]{40}$/.test(value),'invalid-artifact-identity'),
 RER_DEPLOY_RUN_ID:value=>assert(typeof value==='string' && /^\d+$/.test(value),'invalid-artifact-identity'),
 RER_DEPLOY_RUN_ATTEMPT:value=>assert(typeof value==='string' && /^\d+$/.test(value),'invalid-artifact-identity'),
 ...secretValidators,
};
export function validateControllerInputs(env) {
 for(const [key,validate] of Object.entries(controllerValidators))if(env[key]!==undefined)validate(env[key]);
}
