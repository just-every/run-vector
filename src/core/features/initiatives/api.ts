import {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../app/bindings';
import {RequestBodyError} from '../../app/input';
import {authorizeToken,tokenPredicate} from '../integrations/tokens';
import {apiRoute} from '../integrations/api-schema';
import {admitted} from '../integrations/authority';
import {IntegrationError} from '../integrations/errors';
import {admitRate} from '../auth/repository';
import {mutationDatabase,isMutationAccessError,AuthorityChangedError} from '../auth/mutation-database';
import {visibilityDatabase} from '../roles/visibility-database';
import {PaginationInvalidated} from '../issues/list-revision';
import {SettingsError} from '../settings/repository';
import {initiativeAuthority} from './authority';
import {addInitiativeRoutes} from './routes';
export function createInitiativeApi(){
 const app=new Hono<AppEnvironment>();
 app.onError((error,c)=>{
  if(error instanceof IntegrationError||error instanceof SettingsError)return c.json({error:error.code,message:error.message},error.status);
  if(error instanceof z.ZodError||error instanceof RequestBodyError)return c.json({error:'invalid_request'},400);
  if(error instanceof PaginationInvalidated||error instanceof AuthorityChangedError)return c.json({error:'stale_state'},409);
  if(isMutationAccessError(error))return c.json({error:'invalid_token'},401);
  console.error(error);return c.json({error:'initiative_unavailable'},503);
 });
 app.use('*',async(c,next)=>{
  if(!/^\/api\/v1\/initiatives(?:\/|$)/.test(c.req.path))return next();
  const path=c.req.path.slice('/api/v1'.length),route=apiRoute(path,c.req.method);
  if(!route)return c.json({error:'route_not_found'},404);
  if(c.req.header('Origin')&&c.req.header('Origin')!==c.env.APP_ORIGIN)throw new IntegrationError(403,'origin_refused');
  const raw=c.env.DB,actor=await authorizeToken(raw,c.req.raw,route.scopes,c.req.method+':'+path),predicate=tokenPredicate(actor);
  if(!await admitRate(raw,'api-v1:'+actor.workspace+':'+actor.tokenId,300,60000))return c.json({error:'rate_limited'},429,{'Retry-After':String(Math.max(1,Math.ceil((60000-Date.now()%60000)/1000)))});
  c.set('operatorId',actor.id);c.header('Cache-Control','no-store');
  const authority=await initiativeAuthority(c,actor.id,raw);if(authority?.denied)return authority.denied;
  if(!authority)throw new IntegrationError(403,'unregistered_initiative_door');
  c.env={...c.env,DB:mutationDatabase(visibilityDatabase(raw,actor.id),actor.id,undefined,{sql:predicate.sql,values:predicate.params},authority.fence)};
  await next();
  if(!await admitted(raw,predicate)){await c.res.body?.cancel();c.res=c.json({error:'invalid_token'},401);}
 });
 addInitiativeRoutes(app,true);return app;
}
