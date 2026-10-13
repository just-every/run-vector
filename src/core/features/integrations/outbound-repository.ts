import { IntegrationsRepository } from '../../../../vendor/base/integrations';
/** Restore holds are permanent historical exclusions; review admits only new work. */
export class NativeWebhookRepository extends IntegrationsRepository {
 /** Destinations that cannot sign right now: their queued deliveries wait unsent and never crowd out others. */
 skipDestinations:readonly string[]=[];
 async due(now:number,limit=20){
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error('Invalid native delivery bound');
  const skip=this.skipDestinations.length?` AND json_extract(d.envelope,'$.destinationId') NOT IN (${this.skipDestinations.map(()=>'?').join(',')})`:'';
  return (await this.query(`SELECT d.id FROM integration_deliveries d WHERE d.namespace=? AND d.state='queued' AND d.next_at<=? AND d.attempts<d.max_attempts AND NOT EXISTS(SELECT 1 FROM vector_webhook_restore_holds h WHERE h.namespace=d.namespace AND h.id=d.id) AND NOT EXISTS(SELECT 1 FROM vector_webhook_erasures h WHERE h.namespace=d.namespace AND h.id=d.id)${skip} ORDER BY d.next_at,d.id LIMIT ?`,[now,...this.skipDestinations,limit])).map(row=>String(row.id));
 }
 async claim(id:string,now:number,leaseMs:number){
  if((await this.query('SELECT id FROM vector_webhook_restore_holds WHERE namespace=? AND id=? UNION ALL SELECT id FROM vector_webhook_erasures WHERE namespace=? AND id=?',[id,this.namespace,id])).length)return null;
  return super.claim(id,now,leaseMs);
 }
 async recoverExpired(now:number){
  // Historical restored sending/uncertain states retain the source's history.
  // Only this installation's actual attempts may recover as uncertain.
  const rows=await this.query(`SELECT id FROM integration_deliveries d WHERE d.namespace=? AND d.state='sending' AND d.claim_until<=? AND NOT EXISTS(SELECT 1 FROM vector_webhook_restore_holds h WHERE h.namespace=d.namespace AND h.id=d.id)`,[now]);
  for(const row of rows){
   await this.sql.batch([
    {sql:"UPDATE integration_attempts SET finished_at=?,outcome=? WHERE namespace=? AND finished_at IS NULL AND id=(SELECT claim FROM integration_deliveries WHERE namespace=? AND id=? AND state='sending' AND claim_until<=?)",params:[now,JSON.stringify({kind:'uncertain',code:'claim_expired'}),this.namespace,this.namespace,String(row.id),now]},
    {sql:"UPDATE integration_deliveries SET state='uncertain',claim=NULL,claim_until=NULL WHERE namespace=? AND id=? AND state='sending' AND claim_until<=?",params:[this.namespace,String(row.id),now]},
   ]);
  }return rows.map(row=>String(row.id));
 }
}
