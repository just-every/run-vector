import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../app/bindings';
import {readRequestJson} from '../../app/input';
import {IntegrationError} from '../integrations/errors';
import {subscriptionInput} from './schema';
import {subscriptions,subscribe,unsubscribe} from './repository';
import {processMemberSubscriptions} from './process';
export function addSubscriptionRoutes(app:Hono<AppEnvironment>){
 app.use('*',async(c,next)=>{
  if(c.req.method==='GET'&&/^\/api\/notifications(?:\/count)?$/.test(c.req.path))await processMemberSubscriptions(c.env,c.get('operatorId'),c.env.DB);
  return next();
 });
 app.get('/subscriptions',async c=>{if(!z.object({}).strict().safeParse(c.req.query()).success)throw new IntegrationError(400,'invalid_subscription_query');return c.json(await subscriptions(c.env.DB,c.get('operatorId')));});
 app.post('/subscriptions',async c=>{const input=subscriptionInput.safeParse(await readRequestJson(c.req.raw));if(!input.success)throw new IntegrationError(400,'invalid_subscription');return c.json(await subscribe(c.env.DB,c.get('operatorId'),input.data.subjectType,input.data.subjectId),201);});
 app.delete('/subscriptions/:id',async c=>{const parsed=z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/).safeParse(c.req.param('id'));if(!parsed.success)throw new IntegrationError(400,'invalid_subscription');return c.json(await unsubscribe(c.env.DB,c.get('operatorId'),parsed.data));});
}
