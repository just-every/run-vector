import { pageQuery,paginate } from './api-pagination';
import type { Hono } from 'hono';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { administrationId,projectCreateSchema,projectUpdateSchema } from '../administration/schema';
import { createProject,updateProject,removeProject } from '../administration/projects';
import { projectPortfolioQuery } from '../projects/portfolio';
import { projectPortfolio,projectDetail } from '../projects/read';
import { IntegrationError } from './errors';
import type { z } from 'zod';
function parse<T>(schema:z.ZodType<T>,value:unknown) {
  const result=schema.safeParse(value);
  if(!result.success)throw new IntegrationError(400,'invalid_request',result.error.issues.map(i=>i.message).join(' '));
  return result.data;
}
export function addProjectApi(app:Hono<AppEnvironment>) {
  app.get('/projects',async c=>{
    const {limit,cursor,...filters}=parse(projectPortfolioQuery.safeExtend(pageQuery.shape),c.req.query());
    const value=await projectPortfolio(c.env.DB,c.get('operatorId'),filters);
    const page=await paginate(value.projects,c.get('operatorId'),'projects',filters,{limit,cursor});
    return c.json({...value,projects:page.items,total:page.total,nextCursor:page.nextCursor});
  });
  app.delete('/projects/:id',async c=>{
    await removeProject(c.env.DB,c.get('operatorId'),parse(administrationId,c.req.param('id')));
    return c.json({deleted:true});
  });
  app.get('/projects/:id',async c=>{
    const project=await projectDetail(c.env.DB,c.get('operatorId'),parse(administrationId,c.req.param('id')));
    return project?c.json(project):c.json({error:'not_found'},404);
  });
  app.post('/projects',async c=>{
    const id=await createProject(c.env.DB,c.get('operatorId'),parse(projectCreateSchema.omit({createSlackChannel:true}),await readRequestJson(c.req.raw)));
    return c.json(await projectDetail(c.env.DB,c.get('operatorId'),id),201);
  });
  app.patch('/projects/:id',async c=>{
    const id=parse(administrationId,c.req.param('id'));
    await updateProject(c.env.DB,c.get('operatorId'),id,parse(projectUpdateSchema,await readRequestJson(c.req.raw)));
    return c.json(await projectDetail(c.env.DB,c.get('operatorId'),id));
  });
}
