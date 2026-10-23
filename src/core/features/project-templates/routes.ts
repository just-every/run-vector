import type {Hono,Context} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../app/bindings';
import {readRequestJson} from '../../app/input';
import {SettingsError} from '../settings/repository';
import {templateInputSchema,applySchema,captureSchema} from './schema';
import {listTemplates,readTemplate,saveTemplate,deleteTemplate,captureTemplate,applyTemplate} from './service';
export function addProjectTemplateRoutes(app:Hono<AppEnvironment>){
 const action=(run:(c:Context<AppEnvironment>)=>Promise<Response>)=>async(c:Context<AppEnvironment>)=>{try{return await run(c);}catch(e){if(e instanceof SettingsError)return c.json({error:e.code,message:e.message},e.status);if(e instanceof z.ZodError)return c.json({error:'invalid_request',message:'Check template fields, offsets and size (50 milestones, 100 issues).'},400);throw e;}};
 app.get('/project-templates',action(async c=>c.json(await listTemplates(c.env.DB,c.get('operatorId')))));
 app.get('/project-templates/:id',action(async c=>c.json(await readTemplate(c.env.DB,c.get('operatorId'),c.req.param('id')!))));
 app.post('/project-templates',action(async c=>c.json(await saveTemplate(c.env.DB,c.get('operatorId'),templateInputSchema.parse(await readRequestJson(c.req.raw))),201)));
 app.put('/project-templates/:id',action(async c=>{const {expectedVersion,...input}=z.object({expectedVersion:z.number().int().positive()}).passthrough().parse(await readRequestJson(c.req.raw));return c.json(await saveTemplate(c.env.DB,c.get('operatorId'),templateInputSchema.parse(input),c.req.param('id')!,expectedVersion));}));
 app.delete('/project-templates/:id',action(async c=>{const input=z.object({expectedVersion:z.number().int().positive()}).parse(await readRequestJson(c.req.raw));return c.json(await deleteTemplate(c.env.DB,c.get('operatorId'),c.req.param('id')!,input.expectedVersion));}));
 app.post('/project-templates/:id/apply',action(async c=>c.json(await applyTemplate(c.env.DB,c.get('operatorId'),c.req.param('id')!,applySchema.parse(await readRequestJson(c.req.raw))),201)));
 app.post('/project-templates/from-project/:id',action(async c=>c.json(await captureTemplate(c.env.DB,c.get('operatorId'),c.req.param('id')!,captureSchema.parse(await readRequestJson(c.req.raw))),201)));
}
