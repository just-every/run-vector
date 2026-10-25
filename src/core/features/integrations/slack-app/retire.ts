import type {WorkerBindings} from '../../../app/bindings';
import {auditStatement} from '../../audit/producer';
/** Local removal and provider uninstall retire exactly the same custody. */
export function retireSlackWrites(workspace:string,actor:string,provider=false){
 return [
  {sql:'UPDATE vector_slack_installations SET enabled=0 WHERE workspace_id=?',params:[workspace]},
  {sql:'DELETE FROM vector_integration_secret_keys WHERE identity=?',params:['slack:'+workspace]},
  {sql:'DELETE FROM vector_integration_secret_keys WHERE identity=? OR identity LIKE ?',params:['slack-app:'+workspace,'slack-oauth:'+workspace+':%']},
  {sql:"UPDATE vector_webhook_destinations SET enabled=0,revoked_at=COALESCE(revoked_at,?) WHERE workspace_id=? AND kind='slack'",params:[new Date().toISOString(),workspace]},
  auditStatement({workspace,actor,action:provider?'slack.provider_uninstalled':'slack.disconnected',subject:'slack:'+workspace,...(provider?{kind:'integration' as const}:{})}),
 ];
}
export async function providerUninstall(env:WorkerBindings,signer:{workspace:string;encrypted:string}){
 // The signer check and retirement share one D1 transaction. Its intentional
 // signing-key removal makes a post-write signer guard inappropriate.
 const writes=[{sql:"SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_slack_installations s JOIN vector_integration_secret_keys k ON k.identity='slack-signing:'||s.workspace_id AND k.slot='current' WHERE s.workspace_id=? AND s.enabled=1 AND k.encrypted=?) THEN 1 ELSE json('Slack installation changed') END",params:[signer.workspace,signer.encrypted]},...retireSlackWrites(signer.workspace,'slack-app',true)];
 await env.DB.batch(writes.map(write=>env.DB.prepare(write.sql).bind(...write.params)));
 return {ok:true};
}
