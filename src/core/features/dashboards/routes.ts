import type {Hono,Context} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../app/bindings';
import {readRequestJson} from '../../app/input';
import {SettingsError} from '../settings/repository';
import {dashboardInputSchema,dashboardUpdateSchema,dashboardFiltersSchema} from './schema';
import {listDashboards,readDashboard,saveDashboard,deleteDashboard} from './service';
export function addDashboardRoutes(app:Hono<AppEnvironment>) {
 const action=(run:(c:Context<AppEnvironment>)=>Promise<Response>)=>async(c:Context<AppEnvironment>)=>{try{return await run(c);}catch(error){if(error instanceof SettingsError)return c.json({error:error.code,message:error.message},error.status);if(error instanceof z.ZodError)return c.json({error:'invalid_request',message:'Check the dashboard name, widgets and filters.'},400);throw error;}};
 app.get('/dashboards',action(async c=>c.json(await listDashboards(c.env.DB,c.get('operatorId')))));
 app.get('/dashboards/:id',action(async c=>c.json(await readDashboard(c.env.DB,c.get('operatorId'),c.req.param('id')!,dashboardFiltersSchema.parse(c.req.query())))));
 app.post('/dashboards',action(async c=>c.json(await saveDashboard(c.env.DB,c.get('operatorId'),dashboardInputSchema.parse(await readRequestJson(c.req.raw))),201)));
 app.put('/dashboards/:id',action(async c=>{const {expectedVersion,...input}=dashboardUpdateSchema.parse(await readRequestJson(c.req.raw));return c.json(await saveDashboard(c.env.DB,c.get('operatorId'),input,c.req.param('id')!,expectedVersion));}));
 app.delete('/dashboards/:id',action(async c=>{const {expectedVersion}=z.object({expectedVersion:z.number().int().positive()}).strict().parse(await readRequestJson(c.req.raw));return c.json(await deleteDashboard(c.env.DB,c.get('operatorId'),c.req.param('id')!,expectedVersion));}));
}
