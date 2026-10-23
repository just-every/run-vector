import {sha256} from '../../../../../vendor/base/integrations/core/crypto';
import {IntegrationError} from '../errors';
import {gitGuard} from './rules';
export type GithubDelivery={
 db:D1Database;id:string;workspace:string;repository:string;delivery:string;bytes:Uint8Array;
 authority:string;authValues:(string|number|null)[];requireAuthority:()=>Promise<void>;
};
/** Every accepted push/deployment owns one durable, content-bound receipt. */
export async function githubDelivery(context:GithubDelivery,prepare:()=>Promise<{statements:D1PreparedStatement[];diagnostic:string;linked:number}>){
 const {db,id,delivery,bytes,authority,authValues,requireAuthority}=context;
 const hash=await sha256(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
 const prior=()=>db.prepare('SELECT payload_hash,diagnostic FROM vector_github_deliveries WHERE repository_id=? AND delivery_id=?').bind(id,delivery).first<{payload_hash:string;diagnostic:string}>();
 const replay=async(row:{payload_hash:string;diagnostic:string})=>{await requireAuthority();if(row.payload_hash!==hash)throw new IntegrationError(409,'github_delivery_conflict');return {reused:true,diagnostic:row.diagnostic};};
 await requireAuthority();const retained=await prior();if(retained)return replay(retained);
 const plan=await prepare(),at=new Date().toISOString();
 try{await db.batch([gitGuard(db,authority,...authValues),gitGuard(db,'NOT EXISTS(SELECT 1 FROM vector_github_deliveries WHERE repository_id=? AND delivery_id=?)',id,delivery),
 ...plan.statements,db.prepare('INSERT INTO vector_github_deliveries(repository_id,delivery_id,payload_hash,received_at,diagnostic) VALUES(?,?,?,?,?)').bind(id,delivery,hash,at,plan.diagnostic),gitGuard(db,authority,...authValues)]);
 }catch{await requireAuthority();const committed=await prior();if(committed)return replay(committed);throw new IntegrationError(503,'github_durability_unavailable');}
 await requireAuthority();return {reused:false,diagnostic:plan.diagnostic,linked:plan.linked};
}
