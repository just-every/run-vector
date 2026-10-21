import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { readAdministration,readCycle } from '../administration/read';
import { cycleCreateSchema,administrationId } from '../administration/schema';
import { createCycle } from '../administration/cycles';
import { pageQuery,paginate } from './api-pagination';
const querySchema=pageQuery.extend({team:administrationId.optional(),closed:z.enum(['true','false']).optional()}).strict();
export function addCycleApi(app:Hono<AppEnvironment>){
 app.get('/cycles',async c=>{
  const {limit,cursor,...filters}=querySchema.parse(c.req.query());
  const data=await readAdministration(c.env.DB,c.get('operatorId'));
  const rows=data.cycles.filter(row=>(!filters.team||row.teamId===filters.team)&&(filters.closed===undefined||Boolean(row.closedAt)===(filters.closed==='true')));
  const page=await paginate(rows,c.get('operatorId'),'cycles',filters,{limit,cursor});
  return c.json({cycles:page.items,total:page.total,nextCursor:page.nextCursor});
 });
 app.get('/cycles/:id',async c=>c.json(await readCycle(c.env.DB,c.get('operatorId'),c.req.param('id'))));
 app.post('/cycles',async c=>{
  const id=await createCycle(c.env.DB,c.get('operatorId'),cycleCreateSchema.parse(await readRequestJson(c.req.raw)));
  return c.json(await readCycle(c.env.DB,c.get('operatorId'),id),201);
 });
}
