import type {Hono} from 'hono';
import type {AppEnvironment} from '../../../app/bindings';
import {readRequestJson} from '../../../app/input';
import {appManager,saveConnection,removeConnection} from './connection';
import {listConnections} from './project-list';
import {registerHooks} from './hook-registration';
export function addGitlabConfiguration(app:Hono<AppEnvironment>){
 app.get('/settings/integrations/gitlab',async c=>c.json(await listConnections(c.env,await appManager(c.env,c.req.raw))));
 app.post('/settings/integrations/gitlab',async c=>c.json(await saveConnection(c.env,c.req.raw,await readRequestJson(c.req.raw)),201));
 app.post('/settings/integrations/gitlab/:id/hooks',async c=>c.json(await registerHooks(c.env,await appManager(c.env,c.req.raw),c.req.param('id'),await readRequestJson(c.req.raw))));
 app.delete('/settings/integrations/gitlab/:id',async c=>c.json(await removeConnection(c.env,await appManager(c.env,c.req.raw),c.req.param('id'))));
}
