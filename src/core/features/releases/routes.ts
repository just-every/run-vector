import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../app/bindings';
import {readRequestJson} from '../../app/input';
import {pageQuery,paginate} from '../integrations/api-pagination';
import {IntegrationError} from '../integrations/errors';
import {requireIssueAccess} from '../issues/access';
import {releaseInput,releaseEdit,releaseScope} from './schema';
import {listReleases,readRelease,createRelease,editRelease,replaceReleaseScope,issueReleases} from './repository';
const id=z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
function parse<T>(schema:z.ZodType<T>,value:unknown){const result=schema.safeParse(value);if(!result.success)throw new IntegrationError(400,'invalid_release_input');return result.data;}
export function addReleaseRoutes(app:Hono<AppEnvironment>,versioned=false){
 app.get('/releases',async c=>{
  const result=await listReleases(c.env.DB,c.get('operatorId'));if(!versioned)return c.json(result);
  const {limit,cursor,...filters}=pageQuery.extend({team:z.string().length(26).optional(),status:z.enum(['planned','in_progress','released']).optional()}).strict().parse(c.req.query());
  const rows=result.releases.filter(r=>(!filters.team||r.teamId===filters.team)&&(!filters.status||r.status===filters.status));
  const page=await paginate(rows,c.get('operatorId'),'releases',filters,{limit,cursor});return c.json({releases:page.items,total:page.total,nextCursor:page.nextCursor});
 });
 app.post('/releases',async c=>c.json(await createRelease(c.env.DB,c.get('operatorId'),parse(releaseInput,await readRequestJson(c.req.raw))),201));
 app.get('/releases/:id',async c=>c.json(await readRelease(c.env.DB,c.get('operatorId'),parse(id,c.req.param('id')))));
 app.patch('/releases/:id',async c=>c.json(await editRelease(c.env.DB,c.get('operatorId'),parse(id,c.req.param('id')),parse(releaseEdit,await readRequestJson(c.req.raw)))));
 app.put('/releases/:id/scope',async c=>c.json(await replaceReleaseScope(c.env.DB,c.get('operatorId'),parse(id,c.req.param('id')),parse(releaseScope,await readRequestJson(c.req.raw)))));
 if(!versioned)app.get('/issues/:identifier/releases',async c=>{
  const issue=await requireIssueAccess(c.env.DB,c.req.param('identifier'),c.get('operatorId'));
  const result=await issueReleases(c.env.DB,c.get('operatorId'),issue.identifier);await requireIssueAccess(c.env.DB,issue.identifier,c.get('operatorId'));return c.json(result);
 });
}
