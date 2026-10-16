import { Hono } from 'hono';
import type { AppEnvironment } from '../../app/bindings';
import { IntegrationError } from './errors';
import { ingestSource } from './source-ingest';
import { receiveSourceWebhook } from './source-webhook';
import { receiveGithub } from './github/receiver';
export function createIntegrationReceivers(){
 const app=new Hono<AppEnvironment>();
 app.onError((error,c)=>error instanceof IntegrationError?c.json({error:error.code,message:error.message},error.status,{'Cache-Control':'no-store'}):c.json({error:'integration_unavailable'},503,{'Cache-Control':'no-store'}));
 app.post('/sources/:id/events',async c=>c.json(await ingestSource(c.env,c.req.raw,c.req.param('id'))));
 app.post('/sources/:id/receive/:token',async c=>c.json(await receiveSourceWebhook(c.env,c.req.raw,c.req.param('id'),c.req.param('token')),200,{'Cache-Control':'no-store'}));
 app.post('/github/:id',async c=>c.json(await receiveGithub(c.env,c.req.raw,c.req.param('id'))));
 return app;
}
