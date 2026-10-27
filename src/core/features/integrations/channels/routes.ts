import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../../app/bindings';
import {readRequestJson} from '../../../app/input';
import {integrationOwner} from '../authority';
import {IntegrationError} from '../errors';
import {bindingInput,approvalInput,initiativeBindingInput,initiativeBindingWithdrawal} from './schema';
import {approveInitiativeDestination,withdrawInitiativeDestination} from './initiative-approval';
import {readInitiativeBinding,saveInitiativeBinding,withdrawInitiativeBinding} from './initiative-binding';
import {approvedProjectChannels,bindProjectChannel,allowProjectChannel,revokeProjectChannel} from './project-binding';
import {saveSlack,removeSlack,saveBinding,removeBinding,readChannels} from './settings';
import {saveSigningSecret} from '../slack-dm/signing';
function parse<T>(schema:z.ZodType<T>,value:unknown){const result=schema.safeParse(value);if(!result.success)throw new IntegrationError(400,'invalid_channel_settings','Check the channel settings and selected events.');return result.data;}
export function addChannelRoutes(app:Hono<AppEnvironment>){
 const channelId=z.string().regex(/^[CG][A-Z0-9]{2,30}$/),ulid=z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
 app.get('/projects/:id/slack-channel',async c=>c.json(await approvedProjectChannels(c.env,await integrationOwner(c.env,c.req.raw),parse(ulid,c.req.param('id')))));
 app.post('/projects/:id/slack-channel',async c=>{const actor=await integrationOwner(c.env,c.req.raw),input=parse(z.object({channelId}).strict(),await readRequestJson(c.req.raw));return c.json(await bindProjectChannel(c.env,actor,parse(ulid,c.req.param('id')),input.channelId),201);});
 app.post('/settings/integrations/channels/allowed',async c=>{const actor=await integrationOwner(c.env,c.req.raw),input=parse(z.object({channelId,channelName:z.string().trim().min(1).max(120)}).strict(),await readRequestJson(c.req.raw));return c.json(await allowProjectChannel(c.env,actor,input.channelId,input.channelName),201);});
 app.delete('/settings/integrations/channels/allowed/:channelId',async c=>c.json(await revokeProjectChannel(c.env,await integrationOwner(c.env,c.req.raw),parse(channelId,c.req.param('channelId')))));

 // INIT-001 (ct 27 Oct): Owners and Admins approve; the scoped capability binds only what they approved.
 app.post('/settings/integrations/channels/initiative-approvals',async c=>{const actor=await integrationOwner(c.env,c.req.raw);return c.json(await approveInitiativeDestination(c.env,actor,parse(approvalInput,await readRequestJson(c.req.raw))),201);});
 app.delete('/settings/integrations/channels/initiative-approvals/:id',async c=>c.json(await withdrawInitiativeDestination(c.env,await integrationOwner(c.env,c.req.raw),parse(ulid,c.req.param('id')))));
 app.get('/initiatives/:id/channel-binding',async c=>c.json(await readInitiativeBinding(c.env,await integrationOwner(c.env,c.req.raw,c.get('documentProjection')?c.get('operator'):undefined),parse(ulid,c.req.param('id')))));
 app.put('/initiatives/:id/channel-binding',async c=>{const actor=await integrationOwner(c.env,c.req.raw),input=parse(initiativeBindingInput,await readRequestJson(c.req.raw));return c.json(await saveInitiativeBinding(c.env,actor,parse(ulid,c.req.param('id')),input));});
 app.delete('/initiatives/:id/channel-binding',async c=>{const actor=await integrationOwner(c.env,c.req.raw),input=parse(initiativeBindingWithdrawal,await readRequestJson(c.req.raw));return c.json(await withdrawInitiativeBinding(c.env,actor,parse(ulid,c.req.param('id')),input.expectedVersion));});

 app.get('/settings/integrations/channels',async c=>c.json(await readChannels(c.env,await integrationOwner(c.env,c.req.raw))));
 app.post('/settings/integrations/slack',async c=>{const owner=await integrationOwner(c.env,c.req.raw),input=parse(z.object({botToken:z.string().trim().min(10).max(500)}).strict(),await readRequestJson(c.req.raw));return c.json(await saveSlack(c.env,owner,input.botToken));});
 app.delete('/settings/integrations/slack',async c=>c.json(await removeSlack(c.env,await integrationOwner(c.env,c.req.raw))));
 app.post('/settings/integrations/slack/signing-secret',async c=>{const owner=await integrationOwner(c.env,c.req.raw),input=parse(z.object({signingSecret:z.string().trim().regex(/^[A-Za-z0-9]{20,128}$/)}).strict(),await readRequestJson(c.req.raw));return c.json(await saveSigningSecret(c.env,owner,input.signingSecret));});
 app.post('/settings/integrations/channels',async c=>{const owner=await integrationOwner(c.env,c.req.raw);return c.json(await saveBinding(c.env,owner,parse(bindingInput,await readRequestJson(c.req.raw))),201);});
 app.delete('/settings/integrations/channels/:id',async c=>c.json(await removeBinding(c.env,await integrationOwner(c.env,c.req.raw),parse(z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),c.req.param('id')))));
}
