import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../../app/bindings';
import {readRequestJson} from '../../../app/input';
import {integrationOwner} from '../authority';
import {IntegrationError} from '../errors';
import {bindingInput} from './schema';
import {saveSlack,removeSlack,saveBinding,removeBinding,readChannels} from './settings';
function parse<T>(schema:z.ZodType<T>,value:unknown){const result=schema.safeParse(value);if(!result.success)throw new IntegrationError(400,'invalid_channel_settings','Check the channel settings and selected events.');return result.data;}
export function addChannelRoutes(app:Hono<AppEnvironment>){
 app.get('/settings/integrations/channels',async c=>c.json(await readChannels(c.env,await integrationOwner(c.env,c.req.raw))));
 app.post('/settings/integrations/slack',async c=>{const owner=await integrationOwner(c.env,c.req.raw),input=parse(z.object({botToken:z.string().trim().min(10).max(500)}).strict(),await readRequestJson(c.req.raw));return c.json(await saveSlack(c.env,owner,input.botToken));});
 app.delete('/settings/integrations/slack',async c=>c.json(await removeSlack(c.env,await integrationOwner(c.env,c.req.raw))));
 app.post('/settings/integrations/channels',async c=>{const owner=await integrationOwner(c.env,c.req.raw);return c.json(await saveBinding(c.env,owner,parse(bindingInput,await readRequestJson(c.req.raw))),201);});
 app.delete('/settings/integrations/channels/:id',async c=>c.json(await removeBinding(c.env,await integrationOwner(c.env,c.req.raw),parse(z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),c.req.param('id')))));
}
