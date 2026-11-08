import type {Hono} from 'hono';
import type {AppEnvironment} from '../../app/bindings';
import {readRequestJson} from '../../app/input';
import {administrationId} from '../administration/schema';
import {updateProject} from '../administration/projects';
import {SettingsError} from '../administration/transaction';
import {readRoadmap} from './read';
import {roadmapChange} from './schema';
export function addRoadmapRoutes(app:Hono<AppEnvironment>) {
  app.get('/roadmap',async c=>c.json(await readRoadmap(c.env.DB,c.get('operatorId'))));
  app.patch('/roadmap/projects/:id',async c=>{
    const id=administrationId.safeParse(c.req.param('id')),body=roadmapChange.safeParse(await readRequestJson(c.req.raw));
    if(!id.success || !body.success)return c.json({error:'invalid_request',message:'Choose valid planning fields and a current project version.'},400);
    try {
      const {expectedVersion,...change}=body.data;
      await updateProject(c.env.DB,c.get('operatorId'),id.data,change,{combineDates:true,expectedVersion});
      return c.json(await readRoadmap(c.env.DB,c.get('operatorId')));
    } catch(error) {
      if(error instanceof SettingsError)return c.json({error:error.code,message:error.message},error.status);
      throw error;
    }
  });
}
