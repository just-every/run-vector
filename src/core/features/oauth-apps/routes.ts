import {jsonMediaType,formMediaType} from './media-types';
import {z} from 'zod';
import {Hono} from 'hono';
import type {AppEnvironment} from '../../app/bindings';
import {readRequestJson} from '../../app/input';
import {integrationOwner,guardedSql,ownerPredicate} from '../integrations/authority';
import {IntegrationError} from '../integrations/errors';
import {admitRate} from '../auth/repository';
import {applicationInput,authorizationInput,consentInput,exchangeInput} from './schema';
import {authorization,consent,exchange,registerApplication,revokeGrant} from './repository';
function parse<T>(schema:z.ZodType<T>,value:unknown,redirectHelp=false){const result=schema.safeParse(value);if(!result.success)throw new IntegrationError(400,redirectHelp&&result.error.issues[0]?.path[0]==='redirectUris'?'invalid_redirect':'invalid_request',result.error.issues[0]?.message??'Check the application request.');return result.data;}
export function addOAuthRoutes(app:Hono<AppEnvironment>){
 app.get('/settings/oauth-apps',async c=>{
  const owner=await integrationOwner(c.env,c.req.raw,c.get('documentProjection')?c.get('operator'):undefined);
  const [apps,grants]=await guardedSql(c.env.DB,ownerPredicate(owner)).batch([
   {sql:'SELECT id,name,redirect_uris AS redirectUris,scopes,created_at AS createdAt FROM vector_oauth_apps WHERE workspace_id=? ORDER BY created_at DESC',params:[owner.workspace]},
   {sql:`SELECT g.id,a.name AS app,o.name AS member,g.scopes,g.created_at AS createdAt,g.revoked_at AS revokedAt,(SELECT MAX(at) FROM integration_token_usage u WHERE u.namespace=g.namespace AND u.token_id=g.token_id AND u.allowed=1) AS lastUsed FROM vector_oauth_grants g JOIN vector_oauth_apps a ON a.id=g.app_id JOIN operators o ON o.id=g.operator_id WHERE g.workspace_id=? ORDER BY g.created_at DESC`,params:[owner.workspace]},
  ]);return c.json({apps,grants});
 });
 app.post('/settings/oauth-apps',async c=>c.json(await registerApplication(c.env.DB,await integrationOwner(c.env,c.req.raw),parse(applicationInput,await readRequestJson(c.req.raw),true)),201));
 app.delete('/settings/oauth-apps/grants/:id',async c=>{
  const owner=await integrationOwner(c.env,c.req.raw);await revokeGrant(c.env.DB,owner.workspace,owner.id,c.req.param('id'),guardedSql(c.env.DB,ownerPredicate(owner)));return c.json({revoked:true});
 });
 app.get('/oauth/consent',async c=>{
  const owner=await integrationOwner(c.env,c.req.raw,c.get('documentProjection')?c.get('operator'):undefined),input=parse(authorizationInput,c.req.query());
  const {app,scopes}=await authorization(c.env.DB,input,owner.workspace);return c.json({name:app.name,scopes,redirectUri:input.redirect_uri});
 });
 app.post('/oauth/consent',async c=>{
  const owner=await integrationOwner(c.env,c.req.raw),input=parse(consentInput,await readRequestJson(c.req.raw));
  return c.json(await consent(c.env.DB,owner,input.request,input.decision));
 });
}
export function createOAuthPublicApp(now:()=>number=Date.now){
 const app=new Hono<AppEnvironment>();
 app.onError((error,c)=>{
  if(error instanceof IntegrationError){
   const navigation=c.req.header('Sec-Fetch-Mode')==='navigate'||c.req.header('Accept')?.includes('text/html');
   if(error.status===400&&new URL(c.req.url).pathname==='/api/oauth/authorize'&&navigation)
    return c.redirect(c.env.APP_ORIGIN+'/app/settings/oauth-consent?'+new URLSearchParams({error:error.code}),303);
   return c.json({error:error.code,message:error.message},error.status);
  }
  if(error instanceof Error&&error.name==='ZodError')return c.json({error:'invalid_request'},400);
  console.error('OAuth request storage failed.');return c.json({error:'temporarily_unavailable'},503);
 });
 app.use('*',async(c,next)=>{c.header('Cache-Control','no-store');c.header('Pragma','no-cache');c.header('Referrer-Policy','no-referrer');await next();});
 app.get('/authorize',async c=>{
  const input=parse(authorizationInput,c.req.query());await authorization(c.env.DB,input);
  return c.redirect(c.env.APP_ORIGIN+'/app/settings/oauth-consent?'+new URLSearchParams(Object.entries(input).filter((entry):entry is [string,string]=>typeof entry[1]==='string')).toString(),303);
 });
 app.post('/token',async c=>{
  if(!await admitRate(c.env.DB,'oauth-exchange:'+(c.req.header('CF-Connecting-IP')??'unknown'),120,60000))throw new IntegrationError(429,'rate_limited');
  const type=c.req.header('Content-Type')?.split(';')[0];
  let body:Record<string,unknown>;
  if(type===jsonMediaType)body=await readRequestJson(c.req.raw) as Record<string,unknown>;
  else if(type===formMediaType)body=Object.fromEntries(new URLSearchParams(await c.req.text()));
  else throw new IntegrationError(400,'invalid_request');
  const auth=c.req.header('Authorization');
  if(auth){
   if(body.client_secret||!auth.startsWith('Basic '))throw new IntegrationError(401,'invalid_client');
   try{const decoded=atob(auth.slice(6)),separator=decoded.indexOf(':');if(separator<0)throw Error();body={...body,client_id:decodeURIComponent(decoded.slice(0,separator)),client_secret:decodeURIComponent(decoded.slice(separator+1))};}catch{throw new IntegrationError(401,'invalid_client');}
  }
  return c.json(await exchange(c.env.DB,exchangeInput.parse(body),now()));
 });
 return app;
}
