import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../app/bindings';
import {readRequestJson} from '../../app/input';
import {pageQuery,paginate} from '../integrations/api-pagination';
import {IntegrationError} from '../integrations/errors';
import {initiativeInput,initiativeEdit,initiativeProjects,initiativeStatuses} from './schema';
import {listInitiatives,readInitiative,createInitiative,editInitiative,replaceInitiativeProjects} from './repository';
const id=z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
function parse<T>(schema:z.ZodType<T>,value:unknown){const result=schema.safeParse(value);if(!result.success)throw new IntegrationError(400,'invalid_initiative_input');return result.data;}
export function addInitiativeRoutes(app:Hono<AppEnvironment>,versioned=false){
 app.get('/initiatives',async c=>{
  const result=await listInitiatives(c.env.DB,c.get('operatorId'));if(!versioned)return c.json(result);
  const {limit,cursor,...filters}=pageQuery.extend({status:z.enum(initiativeStatuses).optional(),parent:z.string().length(26).optional()}).strict().parse(c.req.query());
  const rows=result.initiatives.filter(n=>(!filters.status||n.status===filters.status)&&(!filters.parent||n.parentId===filters.parent));
  const page=await paginate(rows,c.get('operatorId'),'initiatives',filters,{limit,cursor});return c.json({initiatives:page.items,total:page.total,nextCursor:page.nextCursor});
 });
 app.post('/initiatives',async c=>c.json(await createInitiative(c.env.DB,c.get('operatorId'),parse(initiativeInput,await readRequestJson(c.req.raw))),201));
 app.get('/initiatives/:id',async c=>c.json(await readInitiative(c.env.DB,c.get('operatorId'),parse(id,c.req.param('id')))));
 app.patch('/initiatives/:id',async c=>c.json(await editInitiative(c.env.DB,c.get('operatorId'),parse(id,c.req.param('id')),parse(initiativeEdit,await readRequestJson(c.req.raw)))));
 app.put('/initiatives/:id/projects',async c=>c.json(await replaceInitiativeProjects(c.env.DB,c.get('operatorId'),parse(id,c.req.param('id')),parse(initiativeProjects,await readRequestJson(c.req.raw)))));
}
