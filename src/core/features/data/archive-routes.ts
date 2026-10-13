import type { Hono } from 'hono';
import type { AppEnvironment } from '../../app/bindings';
import { createPortabilityHandler } from '../../../../scripts/base-cli/modules/portability/index.mjs';
import { portabilityPolicy } from './archive-policy.mjs';
import { validateArchiveInventory,validateArchiveAttachments } from './archive-inventory.mjs';
import { requireOperator } from '../auth/service';
/** Cookie authority and same-origin writes remain the native API contract. */
export function addArchiveRoutes(app:Hono<AppEnvironment>) {
 app.all('/portability/*',async c=>{
  const path=new URL(c.req.url).pathname;
  if (path==='/api/portability/imports'||path.startsWith('/api/portability/imports/')) {
   if (!c.env.RESTORE_COORDINATOR) return c.json({error:'restore_coordinator_required'},503);
   return c.env.RESTORE_COORDINATOR.get(c.env.RESTORE_COORDINATOR.idFromName('installation')).fetch(c.req.raw);
  }
  await validateArchiveInventory(c.env.DB);await validateArchiveAttachments(c.env.DB,c.env.FILES);
  const handler=await createPortabilityHandler({db:c.env.DB,buckets:{FILES:c.env.FILES},policy:portabilityPolicy,appOrigin:c.env.APP_ORIGIN,authorize:async request=>{
   const owner=await requireOperator(c.env,request);return owner?.id===c.get('operatorId')?owner.id:null;
  }});
  return await handler(c.req.raw)??c.json({error:'route_not_found'},404);
 });
}
