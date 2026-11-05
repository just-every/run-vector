import type {WorkerBindings} from '../../../app/bindings';
import {createUlid} from '../../../shared/ids';
import {sha256} from '../../../../../vendor/base/integrations/core/crypto';
import {IntegrationError} from '../errors';
import {admitted} from '../authority';
import {openSecret} from '../secrets';
import {rawIntegrationBody} from '../raw-body';
import {gitMove,gitGuard} from '../git-rules';
import {bitbucketPayload,bitbucketReferences} from './input';
const encoder=new TextEncoder();
async function signed(secret:string,header:string|null,body:Uint8Array){
 if(!header||!/^sha256=[a-f0-9]{64}$/.test(header))return false;
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('HMAC',key,new Uint8Array(header.slice(7).match(/../g)!.map(pair=>parseInt(pair,16))),new Uint8Array(body));
}
type Connection={workspace_id:string;repository:string;repository_uuid:string};
export async function receiveBitbucket(env:WorkerBindings,request:Request,id:string){
 if(!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id))throw new IntegrationError(401,'invalid_bitbucket_receiver');
 const db=env.DB,connection=await db.prepare('SELECT * FROM vector_bitbucket_repositories WHERE id=? AND enabled=1 AND revoked_at IS NULL').bind(id).first<Connection>();
 const key=await db.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity=? AND slot='current'").bind('bitbucket:'+id).first<{encrypted:string}>();
 if(!connection||!key)throw new IntegrationError(401,'invalid_bitbucket_receiver');
 const authority=`EXISTS(SELECT 1 FROM vector_bitbucket_repositories r JOIN vector_integration_secret_keys k ON k.identity='bitbucket:'||r.id AND k.slot='current' WHERE r.id=? AND r.workspace_id=? AND r.repository_uuid=? AND r.repository=? AND r.enabled=1 AND r.revoked_at IS NULL AND k.encrypted=?) AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=0))`;
 const values=[id,connection.workspace_id,connection.repository_uuid,connection.repository,key.encrypted];
 const requireAuthority=async()=>{if(!await admitted(db,{sql:authority,params:values}))throw new IntegrationError(401,'invalid_bitbucket_receiver');};
 const bytes=await rawIntegrationBody(request),secret=await openSecret(env,'bitbucket:'+id,key.encrypted);
 if(!await signed(secret,request.headers.get('X-Hub-Signature'),bytes))throw new IntegrationError(401,'invalid_bitbucket_signature');
 const event=request.headers.get('X-Event-Key'),delivery=request.headers.get('X-Request-UUID')?.replace(/^\{(.*)\}$/,'$1').toLowerCase();
 if(!['pullrequest:created','pullrequest:fulfilled'].includes(event??'')||!delivery||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(delivery))throw new IntegrationError(400,'invalid_bitbucket_delivery');
 let raw;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new IntegrationError(400,'invalid_bitbucket_payload');}
 const parsed=bitbucketPayload.safeParse(raw);if(!parsed.success)throw new IntegrationError(400,'invalid_bitbucket_payload');
 const input=parsed.data,pr=input.pullrequest;
 if([input.repository,pr.destination.repository].some(repo=>repo.uuid!==connection.repository_uuid||repo.full_name.toLowerCase()!==connection.repository))throw new IntegrationError(400,'bitbucket_repository_mismatch');
 if((event==='pullrequest:created'&&pr.state!=='OPEN')||(event==='pullrequest:fulfilled'&&pr.state!=='MERGED'))throw new IntegrationError(400,'invalid_bitbucket_state');
 let url;try{url=new URL(pr.links.html.href);}catch{throw new IntegrationError(400,'invalid_bitbucket_url');}
 if(url.origin!=='https://bitbucket.org'||url.username||url.password||url.search||url.hash||url.pathname.toLowerCase()!=='/'+connection.repository+'/pull-requests/'+pr.id)throw new IntegrationError(400,'invalid_bitbucket_url');
 // The event header is not part of Bitbucket's signed body. Bind it to its
 // matching state and to every content receipt, including reuse admission.
 const hash=await sha256(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
 const prior=()=>db.prepare('SELECT payload_hash,event_key,diagnostic FROM vector_bitbucket_deliveries WHERE repository_id=? AND delivery_id=?').bind(id,delivery).first<{payload_hash:string;event_key:string;diagnostic:string}>();
 const reuse=(row:NonNullable<Awaited<ReturnType<typeof prior>>>)=>{if(row.payload_hash!==hash||row.event_key!==event)throw new IntegrationError(409,'bitbucket_delivery_conflict');return {reused:true,diagnostic:row.diagnostic};};
 await requireAuthority();const retained=await prior();if(retained){await requireAuthority();return reuse(retained);}
 const current=await db.prepare('SELECT state,title,updated_at FROM vector_bitbucket_pull_requests WHERE repository_id=? AND number=?').bind(id,pr.id).first<{state:string;title:string;updated_at:string}>();
 const at=new Date().toISOString(),updated=new Date(pr.updated_on).toISOString(),refs=bitbucketReferences(pr.title,pr.description);
 if(refs.length>20)throw new IntegrationError(413,'bitbucket_reference_limit');
 const issues=refs.length?(await db.prepare(`SELECT i.id,i.version FROM issues i JOIN teams t ON t.id=i.team_id WHERE t.workspace_id=? AND i.identifier IN(SELECT value FROM json_each(?))`).bind(connection.workspace_id,JSON.stringify(refs)).all<{id:string;version:number}>()).results:[];
 const stale=!!current&&updated<current.updated_at,conflict=!!current&&updated===current.updated_at&&(pr.state!==current.state||pr.title!==current.title),terminal=current?.state==='MERGED'&&pr.state!=='MERGED';
 const diagnostic=stale?'older_pull_request_state':conflict?'same_time_state_conflict':terminal?'merged_state_retained':!refs.length?'no_issue_reference':issues.length!==refs.length?'unknown_issue_reference':'linked';
 const statements=[gitGuard(db,authority,...values),gitGuard(db,'NOT EXISTS(SELECT 1 FROM vector_bitbucket_deliveries WHERE repository_id=? AND delivery_id=?)',id,delivery),current?gitGuard(db,'EXISTS(SELECT 1 FROM vector_bitbucket_pull_requests WHERE repository_id=? AND number=? AND state=? AND title=? AND updated_at=?)',id,pr.id,current.state,current.title,current.updated_at):gitGuard(db,'NOT EXISTS(SELECT 1 FROM vector_bitbucket_pull_requests WHERE repository_id=? AND number=?)',id,pr.id)];
 if(!stale&&!conflict&&!terminal){
  for(const issue of issues)statements.push(gitGuard(db,'EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=? AND i.version=? AND t.workspace_id=?)',issue.id,issue.version,connection.workspace_id));
  statements.push(db.prepare('INSERT INTO vector_bitbucket_pull_requests(repository_id,number,title,url,state,updated_at,received_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(repository_id,number) DO UPDATE SET title=excluded.title,url=excluded.url,state=excluded.state,updated_at=excluded.updated_at,received_at=excluded.received_at').bind(id,pr.id,pr.title,url.href,pr.state,updated,at));
  for(const issue of issues){
   statements.push(db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at) SELECT ?,?,NULL,'Bitbucket automation','bitbucket.pr_linked',NULL,?,?,? WHERE NOT EXISTS(SELECT 1 FROM vector_bitbucket_issue_links WHERE repository_id=? AND number=? AND issue_id=?)`).bind(createUlid(new Date(at)),issue.id,JSON.stringify({provider:'bitbucket',repository:connection.repository,number:pr.id,state:pr.state}),at,at,id,pr.id,issue.id),db.prepare('INSERT OR IGNORE INTO vector_bitbucket_issue_links(repository_id,number,issue_id,created_at) VALUES(?,?,?,?)').bind(id,pr.id,issue.id,at));
   // A new delivery ID is not a new lifecycle transition. Never reapply a rule
   // to a repeated provider state or resurrect a completed issue on stale open.
   if(!current||current.state!==pr.state)statements.push(...await gitMove(db,issue.id,pr.state==='MERGED'?'merged':'review',at,'Bitbucket automation'));
  }
 }
 statements.push(db.prepare('INSERT INTO vector_bitbucket_deliveries(repository_id,delivery_id,payload_hash,event_key,received_at,diagnostic) VALUES(?,?,?,?,?,?)').bind(id,delivery,hash,event,at,diagnostic),gitGuard(db,authority,...values));
 try{await db.batch(statements);}catch{await requireAuthority();const committed=await prior();if(committed){await requireAuthority();return reuse(committed);}throw new IntegrationError(503,'bitbucket_durability_unavailable');}
 await requireAuthority();return {reused:false,diagnostic,linked:stale||conflict||terminal?0:issues.length};
}
