import type { Hono } from 'hono';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { IntegrationError } from '../integrations/errors';
import { SettingsError } from '../settings/repository';
import { providerInput, credentialInput, confirmationInput, policyInput } from './schema';
import { readModelSettings,reenterProvider,registerProvider,confirmProvider,saveModelPolicy,removeProvider } from './settings';
import { modelPreview } from './gateway';
import type { z } from 'zod';
function parse<T>(schema:z.ZodType<T>,value:unknown) {
  const result=schema.safeParse(value);
  if(!result.success)throw new IntegrationError(400,'invalid_model_settings','Check the model settings and try again.');
  return result.data;
}
function providerId(value:string) {
  if(!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(value))throw new IntegrationError(400,'invalid_model_provider');
  return value;
}
export function addModelRoutes(app:Hono<AppEnvironment>) {
  app.get('/settings/models',async c=>{
    try{return c.json(await readModelSettings(c.env.DB,c.get('operatorId')));}
    catch(error){if(error instanceof SettingsError)return c.json({error:error.code,message:error.message},error.status);throw error;}
  });
  app.post('/settings/models/providers',async c=>c.json(await registerProvider(c.env,c.get('operatorId'),parse(providerInput,await readRequestJson(c.req.raw))),201));
  app.post('/settings/models/providers/:id/confirm',async c=>c.json(await confirmProvider(c.env.DB,c.get('operatorId'),providerId(c.req.param('id')),parse(confirmationInput,await readRequestJson(c.req.raw)))));
  app.put('/settings/models/providers/:id/credential',async c=>c.json(await reenterProvider(c.env,c.get('operatorId'),providerId(c.req.param('id')),parse(credentialInput,await readRequestJson(c.req.raw)).credential)));
  app.delete('/settings/models/providers/:id',async c=>c.json(await removeProvider(c.env.DB,c.get('operatorId'),providerId(c.req.param('id')))));
  app.put('/settings/models/policy',async c=>c.json(await saveModelPolicy(c.env.DB,c.get('operatorId'),parse(policyInput,await readRequestJson(c.req.raw)))));
  app.post('/issues/:identifier/triage-suggestion',async c=>c.json(await modelPreview(c.env,c.get('operatorId'),c.req.param('identifier'))));
}
