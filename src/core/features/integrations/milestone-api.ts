import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { projectMilestoneCreateSchema,projectMilestoneUpdateSchema,projectMilestoneOrderSchema } from '../administration/schema';
import { createProjectMilestone,updateProjectMilestone,removeProjectMilestone,reorderProjectMilestones } from '../administration/project-milestones';
import { projectDetail } from '../projects/read';
import { IntegrationError } from './errors';
import { pageQuery,paginate } from './api-pagination';
const querySchema=pageQuery.extend({completed:z.enum(['true','false']).optional()}).strict();
export function addMilestoneApi(app:Hono<AppEnvironment>){
 const project=async(db:D1Database,actor:string,id:string)=>{
  const value=await projectDetail(db,actor,id);
  if(!value)throw new IntegrationError(404,'not_found');return value;
 };
 app.get('/projects/:id/milestones',async c=>{
  const {limit,cursor,...filters}=querySchema.parse(c.req.query()),value=await project(c.env.DB,c.get('operatorId'),c.req.param('id'));
  const rows=value.milestones.filter(m=>filters.completed===undefined||m.completed===(filters.completed==='true'));
  const page=await paginate(rows,c.get('operatorId'),'milestones',[value.id,filters],{limit,cursor});
  return c.json({milestones:page.items,total:page.total,nextCursor:page.nextCursor});
 });
 app.get('/projects/:id/milestones/:milestoneId',async c=>{
  const value=await project(c.env.DB,c.get('operatorId'),c.req.param('id')),row=value.milestones.find(m=>m.id===c.req.param('milestoneId'));
  if(!row)throw new IntegrationError(404,'not_found');return c.json(row);
 });
 app.post('/projects/:id/milestones',async c=>{
  const id=await createProjectMilestone(c.env.DB,c.get('operatorId'),c.req.param('id'),projectMilestoneCreateSchema.parse(await readRequestJson(c.req.raw)));
  const value=await project(c.env.DB,c.get('operatorId'),c.req.param('id'));
  return c.json(value.milestones.find(m=>m.id===id),201);
 });
 app.patch('/projects/:id/milestones/:milestoneId',async c=>{
  await updateProjectMilestone(c.env.DB,c.get('operatorId'),c.req.param('id'),c.req.param('milestoneId'),projectMilestoneUpdateSchema.parse(await readRequestJson(c.req.raw)));
  const value=await project(c.env.DB,c.get('operatorId'),c.req.param('id'));
  return c.json(value.milestones.find(m=>m.id===c.req.param('milestoneId')));
 });
 app.put('/projects/:id/milestones/order',async c=>{
  await reorderProjectMilestones(c.env.DB,c.get('operatorId'),c.req.param('id'),projectMilestoneOrderSchema.parse(await readRequestJson(c.req.raw)).milestoneIds);
  return c.json({updated:true});
 });
 app.delete('/projects/:id/milestones/:milestoneId',async c=>{
  await removeProjectMilestone(c.env.DB,c.get('operatorId'),c.req.param('id'),c.req.param('milestoneId'));return c.json({deleted:true});
 });
}
