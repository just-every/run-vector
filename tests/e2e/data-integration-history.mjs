import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {createWebhookProtocol} from '../../vendor/base/integrations/core/webhook.ts';
// Complete real HTTP replies before the next dependent native operation.
const requestNative=async(url,options)=>{
 const response=await fetch(url,options),bytes=await response.arrayBuffer();
 return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
};
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
async function signedSource(installation,config,input){
 const receiver=installation.origin+'/api/integrations/sources/'+config.id+'/events';
 const protocol=createWebhookProtocol({resolveDestination:async()=>receiver,signingKey:async()=>new Uint8Array(Buffer.from(config.secret,'hex'))});
 const wire=await protocol.prepare({id:randomUUID(),tenant:config.workspaceId,destinationId:config.sourceId,event:'signal.revision',protocol:'webhook',body:JSON.stringify(input)},Date.now());
 return requestNative(receiver,{method:'POST',headers:wire.headers,body:wire.body});
}
async function signedGithub(installation,config,input,delivery){
 const body=JSON.stringify(input),signature=createHmac('sha256',config.secret).update(body).digest('hex');
 return requestNative(installation.origin+'/api/integrations/github/'+config.id,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+signature,'X-GitHub-Delivery':delivery,'X-GitHub-Event':'pull_request'},body});
}
export async function populateIntegrationHistory(installation,cookie,identifier){
 const api=async(path,body,status=201)=>{const response=await installation.req('/api/settings/integrations'+path,'POST',body,cookie);assert.equal(response.status,status);return response.json();};
 const admin=await(await installation.req('/api/settings/administration','GET',undefined,cookie)).json(),team=admin.teams.find(row=>!row.archivedAt);
 const token=await api('/tokens',{name:'Retained API profile',scopes:['issues:read']}),usage=await requestNative(installation.origin+'/api/v1/issues',{headers:{Authorization:'Bearer '+token.token}});assert.equal(usage.status,200);await usage.body.cancel();
 const source=await api('/sources',{name:'Restored source',sourceId:'archive-source',teamId:team.id}),input={teamId:team.id,title:'Retained signed evidence',summary:'Original source revision',sourceRecordId:'archive-record',sourceRevisionId:'archive-revision',observedAt:'2026-10-01T00:00:00.000Z'};
 const admitted=await signedSource(installation,source,input);assert.equal(admitted.status,200);const signal=await admitted.json();
 const github=await api('/github',{name:'Retained PR source',repository:'octocat/linguist'}),delivery=randomUUID(),pr={action:'closed',number:9,repository:{full_name:'octocat/linguist'},pull_request:{number:9,title:'Fix '+identifier,body:'Native '+identifier,html_url:'https://github.com/octocat/linguist/pull/9',state:'closed',merged:true,updated_at:'2026-10-01T00:00:00.000Z'}};
 assert.equal((await signedGithub(installation,github,pr,delivery)).status,200);
 const destination=await api('/destinations',{name:'Retained receiver',url:'https://receiver.example.com/events'});
 const created=await installation.req('/api/issues','POST',{teamId:team.id,title:'Retained native webhook queue'},cookie);assert.equal(created.status,201);await created.body.cancel();
 // Paid-edge historical outcomes are fixture data in the real Base tables.
 // Native queueing and transport outcomes are independently exercised by the TLS journey.
 const at=Date.now(),namespace=admin.workspace.id,sql=[];
 for(const [index,state] of ['queued','accepted','uncertain'].entries()){
  const id='retained-webhook-'+index,envelope=JSON.stringify({id,tenant:namespace,destinationId:destination.id,event:'issue.created',protocol:'webhook',body:JSON.stringify({identifier,version:1})});
  sql.push(`INSERT INTO integration_deliveries(namespace,id,fingerprint,destination_hash,envelope,state,attempts,created_at,next_at,max_attempts,retry_delays) VALUES(${quote(namespace)},${quote(id)},'retained-fingerprint','retained-destination',${quote(envelope)},${quote(state)},${index?1:0},${at},${at},3,'[1000,2000]')`);
  if(index)sql.push(`INSERT INTO integration_attempts(namespace,id,delivery_id,number,started_at,finished_at,outcome) VALUES(${quote(namespace)},${quote(id)},${quote(id)},1,${at},${at},${quote(state)})`);
 }
 sql.push(`INSERT INTO integration_replays(namespace,id,fingerprint,envelope,received_at) VALUES(${quote(namespace)},'retained-replay','retained-content','{}',${at})`);
 installation.fixture(sql.join(';')+';');
 return {source,input,signal,github,pr,delivery,token,destination};
}
export function verifyIntegrationCategories(records){
 const names=['vector_integration_tokens','integration_token_usage','integration_token_events','vector_integration_sources','vector_source_records','vector_source_receipts','vector_webhook_destinations','vector_webhook_events','integration_deliveries','integration_attempts','integration_replays','vector_github_repositories','vector_github_deliveries','vector_github_pull_requests','vector_github_issue_links'];
 for(const name of names)assert(records[0].tables.find(row=>row.name===name)?.count>0,'Retained integration history: '+name);
 const items=JSON.stringify(records.filter(row=>row.kind==='part').flatMap(row=>row.items));
 assert(!items.includes('token_hash'));assert(!items.includes('encrypted'));return names;
}
export async function verifyRestoredIntegrations(installation,cookie,fixture,identifier,reviewEffects){
 assert.equal(installation.sql('SELECT count(*) AS n FROM integration_tokens')[0].n,0);assert.equal(installation.sql('SELECT count(*) AS n FROM vector_integration_secret_keys')[0].n,0);
 const config=await(await installation.req('/api/settings/integrations','GET',undefined,cookie)).json();
 for(const kind of ['sources','destinations','github','tokens'])assert(config[kind].every(row=>row.requiresReentry===1));
 assert.equal((await requestNative(installation.origin+'/api/v1/issues',{headers:{Authorization:'Bearer '+fixture.token.token}})).status,401);
 assert.equal((await signedSource(installation,fixture.source,fixture.input)).status,401);assert.equal((await signedGithub(installation,fixture.github,fixture.pr,fixture.delivery)).status,401);
 const history=installation.sql('SELECT * FROM integration_deliveries ORDER BY namespace,id'),attempts=installation.sql('SELECT * FROM integration_attempts ORDER BY namespace,id'),events=installation.sql('SELECT * FROM vector_webhook_events ORDER BY id');
 for(const phase of ['before review','after review']){
  if(phase==='after review')await reviewEffects();
  await installation.scheduledRun();
  assert.deepEqual(installation.sql('SELECT * FROM integration_deliveries ORDER BY namespace,id'),history);assert.deepEqual(installation.sql('SELECT * FROM integration_attempts ORDER BY namespace,id'),attempts);assert.deepEqual(installation.sql('SELECT * FROM vector_webhook_events ORDER BY id'),events);
 }
 const projection=await(await installation.req('/api/issues/'+identifier+'/github','GET',undefined,cookie)).json();assert(projection.pullRequests.some(row=>row.state==='merged'&&row.number===9));
 const evidenceBefore=installation.sql('SELECT count(*) AS n FROM evidence_revisions')[0].n,rotated=await(await installation.req('/api/settings/integrations/sources/'+fixture.source.id+'/rotate','POST',{overlapHours:0},cookie)).json();
 const replay=await signedSource(installation,{...fixture.source,secret:rotated.secret},fixture.input);assert.equal(replay.status,200);assert.equal((await replay.json()).reused,true);assert.equal(installation.sql('SELECT count(*) AS n FROM evidence_revisions')[0].n,evidenceBefore);
}
