import type { WorkerBindings } from '../../app/bindings';
import { openSecret } from './secrets';
export type SigningProblem='secret_missing'|'secret_unreadable';
/** Destinations that cannot sign today: the credential was excluded by a restore, or no longer opens. */
export async function destinationSigningProblems(env:WorkerBindings,workspace:string){
 const rows=(await env.DB.prepare(`SELECT d.id,k.encrypted FROM vector_webhook_destinations d LEFT JOIN vector_integration_secret_keys k ON k.identity='destination:'||d.id AND k.slot='current' WHERE d.workspace_id=? AND d.kind='webhook' AND d.revoked_at IS NULL LIMIT 100`).bind(workspace).all<{id:string;encrypted:string|null}>()).results;
 const problems=new Map<string,SigningProblem>();
 for(const row of rows){
  if(!row.encrypted){problems.set(row.id,'secret_missing');continue;}
  try{await openSecret(env,'destination:'+row.id,row.encrypted);}catch{problems.set(row.id,'secret_unreadable');}
 }
 return problems;
}
