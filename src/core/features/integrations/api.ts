import { addProjectApi } from "./project-api";
import { SettingsError } from "../administration/transaction";
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson,RequestBodyError } from '../../app/input';
import { configureNotifications,needsNotificationDrain,notificationEventIds } from '../notifications/context';
import { drainNotificationMail } from '../notifications/mail';
import { mutationDatabase,isMutationAccessError,fileSettlementDatabase } from '../auth/mutation-database';
import { createIssueInputSchema } from '../issues/input';
import { createIssue } from '../issues/mutations';
import { IssueAccessError,requireIssueAccess } from '../issues/access';
import { IssueMutationError } from '../issues/errors';
import { getIssueDetail } from '../issues/service';
import { issueListQuerySchema } from '../issues/list-schema';
import { issueListResponse,listIssues } from '../issues/list';
import { PaginationInvalidated } from '../issues/list-revision';
import { updateIssueSchema } from '../issue-edit/routes';
import { updateIssueRecord } from '../issue-edit/repository';
import { addComment } from '../discussion/repository';
import { addDescriptionHistoryRoutes } from '../description-history/routes';
import { readAdministration } from '../administration/read';
import { IntegrationError } from './errors';
import { authorizeToken,tokenPredicate } from './tokens';
import { admitted } from './authority';
const identifier=z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
const comment=z.object({body:z.string().trim().min(1).max(100000)}).strict();
function parse<T>(schema:z.ZodType<T>,input:unknown){const value=schema.safeParse(input);if(!value.success)throw new IntegrationError(400,'invalid_request');return value.data;}
/** Bearers admit only this versioned API, never documents, files or functions. */
export function createIntegrationApi(){
 const app=new Hono<AppEnvironment>();
 app.onError((error,c)=>{
  if(error instanceof SettingsError)return c.json({error:error.code,message:error.message},error.status);
  if(error instanceof IntegrationError)return c.json({error:error.code,message:error.message},error.status);
  if(error instanceof IssueAccessError)return c.json({error:error.code},error.status);
  if(isMutationAccessError(error))return c.json({error:'invalid_token'},401);
  if(error instanceof RequestBodyError)return c.json({error:'invalid_request'},error.status);
  if(error instanceof PaginationInvalidated)return c.json({error:'pagination_invalidated'},409);
  if(error instanceof IssueMutationError)return c.json({error:error.code,message:error.message},error.code==='issue_not_found'?404:error.code==='invalid_transition'?409:400);
  return c.json({error:'integration_unavailable'},503);
 });
 app.use('*',async(c,next)=>{
  const path=c.req.path.replace(/^\/api\/v1/,''),method=c.req.method;
  let scopes:readonly string[];
  if(method==='GET'&&(path==='/issues'||/^\/issues\/[A-Z]{2,10}-[1-9][0-9]*(?:\/description-history)?$/.test(path)))scopes=['issues:read'];
  else if(method==='GET'&&(path==='/projects'||/^\/projects\/[0-9A-HJKMNP-TV-Z]{26}$/.test(path)))scopes=['projects:read'];
  else if((method==='POST'&&path==='/projects')||(method==='PATCH'&&/^\/projects\/[0-9A-HJKMNP-TV-Z]{26}$/.test(path)))scopes=['projects:write'];
  else if(method==='GET'&&path==='/metadata')scopes=['metadata:read'];
  else if((method==='POST'&&(path==='/issues'||/^\/issues\/[A-Z]{2,10}-[1-9][0-9]*\/(?:description-restore|checklist)$/.test(path)))||(method==='PATCH'&&/^\/issues\/[A-Z]{2,10}-[1-9][0-9]*$/.test(path)))scopes=['issues:write'];
  else if(method==='POST'&&/^\/issues\/[A-Z]{2,10}-[1-9][0-9]*\/comments(?:\/[0-9A-HJKMNP-TV-Z]{26}\/checklist)?$/.test(path))scopes=['comments:write'];
  else return c.json({error:'route_not_found'},404);
  // Cookie-authenticated browsers may not turn another origin into a bearer
  // write. Server clients omit Origin; if supplied it must be the saved origin.
  if(c.req.header('Origin')&&c.req.header('Origin')!==c.env.APP_ORIGIN)throw new IntegrationError(403,'origin_refused');
  const raw=c.env.DB,actor=await authorizeToken(raw,c.req.raw,scopes,method+':'+path),predicate=tokenPredicate(actor);
  c.set('operatorId',actor.id);c.header('Cache-Control','no-store');
  c.env={...c.env,DB:mutationDatabase(raw,actor.id,undefined,{sql:predicate.sql,values:predicate.params})};
  configureNotifications(c.env.DB,c.env);
  try{await next();}finally{if(await needsNotificationDrain(c.env.DB)){try{await drainNotificationMail({...c.env,DB:fileSettlementDatabase(c.env.DB)},{eventIds:notificationEventIds(c.env.DB)});}catch{console.error('Integration notification delivery interrupted; durable intent retained.');}}}
  if(!await admitted(raw,predicate)){await c.res.body?.cancel();c.res=c.json({error:'invalid_token'},401,{'Cache-Control':'no-store'});}
 });
 app.get('/metadata',async c=>c.json(await readAdministration(c.env.DB,c.get('operatorId'))));
 app.get('/issues',async c=>{
  const query=c.req.query(),allowed=Object.keys(issueListQuerySchema.shape);
  if(Object.keys(query).some(key=>!allowed.includes(key)))throw new IntegrationError(400,'invalid_query');
  return c.json(issueListResponse(await listIssues(c.env.DB,c.get('operatorId'),parse(issueListQuerySchema,query))));
 });
 app.get('/issues/:identifier',async c=>{const id=parse(identifier,c.req.param('identifier'));await requireIssueAccess(c.env.DB,id,c.get('operatorId'));const value=await getIssueDetail(c.env.DB,id,new Date());await requireIssueAccess(c.env.DB,id,c.get('operatorId'));return c.json(value);});
 app.post('/issues',async c=>c.json(await createIssue(c.env.DB,c.get('operatorId'),parse(createIssueInputSchema,await readRequestJson(c.req.raw))),201));
 app.patch('/issues/:identifier',async c=>{const id=parse(identifier,c.req.param('identifier')),input=parse(updateIssueSchema,await readRequestJson(c.req.raw));await requireIssueAccess(c.env.DB,id,c.get('operatorId'));const state=await updateIssueRecord(c.env.DB,id,c.get('operatorId'),input),issue=await getIssueDetail(c.env.DB,id,new Date());await requireIssueAccess(c.env.DB,id,c.get('operatorId'));return state==='stale'?c.json({error:'stale_version',version:issue?.version},409):c.json(issue);});
 app.post('/issues/:identifier/comments',async c=>{const id=parse(identifier,c.req.param('identifier')),input=parse(comment,await readRequestJson(c.req.raw)),issue=await requireIssueAccess(c.env.DB,id,c.get('operatorId'));return c.json({id:await addComment(c.env.DB,issue.id,c.get('operatorId'),input.body)},201);});
 addProjectApi(app);
 addDescriptionHistoryRoutes(app,false);
 return app;
}
