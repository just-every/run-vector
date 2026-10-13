import type { Hono } from 'hono';
import type { AppEnvironment } from '../../app/bindings';
export function addRestoreRoutes(app:Hono<AppEnvironment>) {
 app.get('/data/restore',async c=>{
  const status=await c.env.DB.prepare(`SELECT s.effects_held AS effectsHeld,s.reviewed_at AS reviewedAt,s.import_id AS importId,
   j.phase,json_extract(j.metadata,'$.contentHash') AS contentHash
   FROM vector_restore_status s JOIN rer_portability_jobs j ON j.id=s.import_id WHERE s.id=1`).first();
  const operators=(await c.env.DB.prepare(`SELECT o.id,o.name,o.email,
   EXISTS(SELECT 1 FROM vector_restore_operator_grants g WHERE g.auth_id=m.auth_id) AS approved,
   auth.status='active' AS eligible
   FROM operators o JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators auth ON auth.id=m.auth_id JOIN operators actor ON actor.workspace_id=o.workspace_id
   WHERE actor.id=? AND o.removed_at IS NULL ORDER BY o.name,o.id`).bind(c.get('operatorId')).all()).results;
  return c.json({restored:Boolean(status),status,operators});
 });
 app.post('/data/restore/operators/:id',async c=>{
  const id=c.req.param('id');if(!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id))return c.json({error:'invalid_request'},400);
  const result=await c.env.DB.prepare(`INSERT INTO vector_restore_operator_grants(auth_id,approved_at)
   SELECT m.auth_id,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM operators target
   JOIN vector_auth_operators m ON m.operator_id=target.id JOIN oa_operators auth ON auth.id=m.auth_id
   JOIN operators actor ON actor.workspace_id=target.workspace_id
   WHERE target.id=? AND actor.id=? AND actor.removed_at IS NULL AND target.removed_at IS NULL
   AND auth.status='active' AND EXISTS(SELECT 1 FROM vector_restore_status)
   ON CONFLICT(auth_id) DO NOTHING`).bind(id,c.get('operatorId')).run();
  return result.meta.changes?c.json({approved:true}):c.json({error:'restore_operator_unavailable'},409);
 });
 app.post('/data/restore/review-effects',async c=>{
  const result=await c.env.DB.prepare(`UPDATE vector_restore_status SET effects_held=0,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
   WHERE id=1 AND effects_held=1 AND EXISTS(SELECT 1 FROM operators WHERE id=? AND removed_at IS NULL)`).bind(c.get('operatorId')).run();
  return result.meta.changes?c.json({reviewed:true,historicalDeliveriesQuarantined:true}):c.json({error:'restore_review_unavailable'},409);
 });
}
