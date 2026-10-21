import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { settingsActor } from '../settings/repository';
import { requireIssueAccess } from '../issues/access';
import { changeComment } from '../discussion/repository';
import { liveComment, requireCommentChange } from '../discussion/permissions';
import { commentVersionSql } from '../discussion/revision';
import { IntegrationError } from './errors';
import { pageQuery,paginate } from './api-pagination';
const querySchema=pageQuery.extend({issue:z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/).optional(),createdFrom:z.iso.datetime().optional(),createdTo:z.iso.datetime().optional()}).strict().refine(q=>!q.createdFrom||!q.createdTo||q.createdFrom<=q.createdTo);
const versionSchema=z.object({expectedVersion:z.number().int().nonnegative()}).strict();
const bodySchema=versionSchema.extend({body:z.string().trim().min(1).max(100000)}).strict();
type Row={id:string;issueId:string;issueIdentifier:string;body:string;version:number;authorId:string;authorName:string;createdAt:string;editedAt:string|null};
async function read(db:D1Database,actor:string,filters:{id?:string;issue?:string;createdFrom?:string;createdTo?:string}){
 const owner=await settingsActor(db,actor);
 const result=await db.prepare(`SELECT c.id,c.issue_id AS issueId,i.identifier AS issueIdentifier,c.body,${commentVersionSql} AS version,c.actor_operator_id AS authorId,COALESCE(c.imported_author_name,o.name) AS authorName,c.created_at AS createdAt,c.edited_at AS editedAt
 FROM issue_comments c JOIN issues i ON i.id=c.issue_id JOIN teams t ON t.id=i.team_id JOIN operators o ON o.id=c.actor_operator_id
 WHERE t.workspace_id=? AND c.deleted_at IS NULL AND (? IS NULL OR c.id=?) AND (? IS NULL OR i.identifier=?) AND (? IS NULL OR c.created_at>=?) AND (? IS NULL OR c.created_at<=?) ORDER BY c.created_at,c.id`).bind(owner.workspace_id,filters.id??null,filters.id??null,filters.issue??null,filters.issue??null,filters.createdFrom??null,filters.createdFrom??null,filters.createdTo??null,filters.createdTo??null).all<Row>();
 for(const identifier of new Set(result.results.map(row=>row.issueIdentifier)))await requireIssueAccess(db,identifier,actor);
 return result.results;
}
function projection(row:Row,origin:string){return {id:row.id,issueIdentifier:row.issueIdentifier,body:row.body,version:row.version,author:{id:row.authorId,displayName:row.authorName},createdAt:row.createdAt,editedAt:row.editedAt,url:origin+'/app/issues/'+row.issueIdentifier,maxBodyLength:100000,truncated:false};}
export function addCommentApi(app:Hono<AppEnvironment>){
 app.get('/comments',async c=>{
  const query=querySchema.parse(c.req.query()),{limit,cursor,...filters}=query;
  const rows=await read(c.env.DB,c.get('operatorId'),filters);
  const page=await paginate(rows,c.get('operatorId'),'comments',filters,{limit,cursor});
  return c.json({comments:page.items.map(row=>projection(row,c.env.APP_ORIGIN)),total:page.total,nextCursor:page.nextCursor});
 });
 app.get('/comments/:id',async c=>{
  z.object({}).strict().parse(c.req.query());
  const [row]=await read(c.env.DB,c.get('operatorId'),{id:c.req.param('id')});
  if(!row)throw new IntegrationError(404,'not_found');
  return c.json(projection(row,c.env.APP_ORIGIN));
 });
 for(const method of ['PATCH','DELETE'] as const)app.on(method,'/comments/:id',async c=>{
  const [row]=await read(c.env.DB,c.get('operatorId'),{id:c.req.param('id')});
  if(!row)throw new IntegrationError(404,'not_found');
  const live=await liveComment(c.env.DB,row.issueId,row.id,c.get('operatorId'));
  if(!live)throw new IntegrationError(404,'not_found');
  requireCommentChange(live,method==='PATCH'?'edit':'delete');
  const json=await readRequestJson(c.req.raw);
  const input=method==='PATCH'?bodySchema.parse(json):{...versionSchema.parse(json),body:null};
  const body=input.body;
  const changed=await changeComment(c.env.DB,{id:row.issueId,identifier:row.issueIdentifier},row.id,c.get('operatorId'),body,input.expectedVersion);
  if(!changed)throw new IntegrationError(404,'not_found');
  return c.json({updated:true});
 });
}
