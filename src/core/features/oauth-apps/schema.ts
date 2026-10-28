import {z} from 'zod';
import {tokenScopes} from '../integrations/feature-scopes';
const redirect=z.string().max(2048).refine(value=>{
 try{const u=new URL(value);return !u.hash&&!u.username&&!u.password&&(u.protocol==='https:'||u.protocol==='http:'&&['127.0.0.1','[::1]','localhost'].includes(u.hostname));}catch{return false;}
},'Use an exact HTTPS redirect URL, or loopback HTTP for development.');
export const applicationInput=z.object({name:z.string().trim().min(1).max(200),redirectUris:z.array(redirect).min(1).max(10),scopes:z.array(z.enum(tokenScopes)).min(1).max(100)}).strict();
export const authorizationInput=z.object({response_type:z.literal('code'),client_id:z.string().uuid(),redirect_uri:redirect,scope:z.string().min(1).max(3000),state:z.string().min(1).max(1000),code_challenge:z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),code_challenge_method:z.literal('S256').optional()}).strict().refine(v=>Boolean(v.code_challenge)===Boolean(v.code_challenge_method),'PKCE requires S256 and a challenge.');
export const consentInput=z.object({request:authorizationInput,decision:z.enum(['approve','deny'])}).strict();
export const exchangeInput=z.object({grant_type:z.literal('authorization_code'),client_id:z.string().uuid(),client_secret:z.string().min(1).max(256),code:z.string().max(256),redirect_uri:redirect,code_verifier:z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/).optional()}).strict();
export type AuthorizationRequest=z.infer<typeof authorizationInput>;
