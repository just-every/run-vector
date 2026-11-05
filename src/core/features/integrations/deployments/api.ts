import type {Hono} from 'hono';
import type {AppEnvironment} from '../../../app/bindings';
import {readRequestJson} from '../../../app/input';
import {deploymentReportSchema} from './schema';
import {recordDeployment} from './repository';
export function addDeploymentApi(app:Hono<AppEnvironment>){
 app.post('/deployments',async c=>c.json(await recordDeployment(c.env.DB,c.get('operatorId'),deploymentReportSchema.parse(await readRequestJson(c.req.raw)))));
}
