import type { Hono } from 'hono';
import type { AppEnvironment } from '../../app/bindings';
import { SettingsError } from '../settings/repository';
import { projectDetail } from '../projects/read';
import { projectDependencyParams } from './schema';
import { setProjectDependency } from './repository';

export function addProjectDependencyRoutes(app: Hono<AppEnvironment>) {
  for(const method of ['PUT','DELETE'] as const)app.on(method,'/projects/:id/dependencies/:blockingId',async c=>{
    const parsed=projectDependencyParams.safeParse(c.req.param());
    if(!parsed.success)return c.json({error:'invalid_request'},400);
    const {id,blockingId}=parsed.data;
    try {
      await setProjectDependency(c.env.DB,c.get('operatorId'),id,blockingId,method==='PUT');
      const project=await projectDetail(c.env.DB,c.get('operatorId'),id);
      return project?c.json(project):c.json({error:'not_found'},404);
    } catch(error) {
      if(error instanceof SettingsError)return c.json({error:error.code,message:error.message},error.status);
      throw error;
    }
  });
}
