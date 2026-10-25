import {memberMapping,readMembers,mapMember,removeMember} from './members';
import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../../app/bindings';
import {readRequestJson} from '../../../app/input';
import {IntegrationError} from '../errors';
import {appManager,readApp,saveApp,createApp,beginInstall} from './install';
export function addSlackAppRoutes(app:Hono<AppEnvironment>){
 app.get('/settings/integrations/slack/app/members',async c=>c.json(await readMembers(c.env,await appManager(c.env,c.req.raw))));
 app.post('/settings/integrations/slack/app/members',async c=>{const owner=await appManager(c.env,c.req.raw),input=memberMapping.safeParse(await readRequestJson(c.req.raw));if(!input.success)throw new IntegrationError(400,'slack_member_mapping_invalid');return c.json(await mapMember(c.env,owner,input.data));});
 app.delete('/settings/integrations/slack/app/members/:operatorId',async c=>{const owner=await appManager(c.env,c.req.raw),id=c.req.param('operatorId');if(!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id))throw new IntegrationError(400,'slack_member_mapping_invalid');return c.json(await removeMember(c.env,owner,id));});
 app.get('/settings/integrations/slack/app',async c=>c.json(await readApp(c.env,await appManager(c.env,c.req.raw))));
 app.post('/settings/integrations/slack/app',async c=>c.json(await saveApp(c.env,await appManager(c.env,c.req.raw),await readRequestJson(c.req.raw))));
 app.post('/settings/integrations/slack/app/create',async c=>{
  const owner=await appManager(c.env,c.req.raw),parsed=z.object({configurationToken:z.string().min(10).max(1000)}).strict().safeParse(await readRequestJson(c.req.raw));
  if(!parsed.success)throw new IntegrationError(400,'slack_configuration_token_required');
  return c.json(await createApp(c.env,owner,parsed.data.configurationToken));
 });
 app.post('/settings/integrations/slack/app/install',async c=>c.json(await beginInstall(c.env,await appManager(c.env,c.req.raw))));
}
