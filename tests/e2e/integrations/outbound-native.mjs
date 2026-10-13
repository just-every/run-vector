import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:https';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {getPlatformProxy} from 'wrangler';
import {createDevEgress} from '../../../vendor/base/egress-service/testing/dev-egress.ts';
import {nodeLoopbackSockets} from '../../../vendor/base/egress-service/testing/node-socket.mjs';
import {testTls} from '../../../vendor/base/egress-service/testing/wasm-tls.mjs';
import {dispatchWebhooks,outboundService} from '../../../src/core/features/integrations/outbound.ts';
import {waveBWorker} from '../wave-b-worker.mjs';
import {freePort} from '@runeditrun/rer/adapter-settings';
const work=await mkdtemp(join(tmpdir(),'vector-egress-'));let proxy,receiver,worker;const origin='http://127.0.0.1:'+await freePort();
const proof={passed:false,nativeQueue:false,enforcingTransport:'Base egress-service EgressTransport (createDevEgress)',networkEdge:'synthetic DNS answers and loopback sockets; real WASM rustls TLS to a test CA; no external connection',hmacVerified:false,replaySafe:false,uncertain:false,restarted:false,retryBounded:false,privateDnsRefused:false,redirectNotFollowed:false};
try{
 // A test CA and one receiver certificate for the three synthetic names, as Base's egress tests issue them.
 const openssl=args=>execFileSync('openssl',args,{cwd:work,stdio:'ignore'});
 openssl(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout','ca.key','-out','ca.pem','-subj','/CN=Vector egress test CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign']);
 openssl(['req','-newkey','rsa:2048','-nodes','-keyout','key.pem','-out','receiver.csr','-subj','/CN=receiver.example.com']);
 await writeFile(join(work,'receiver.ext'),'subjectAltName=DNS:receiver.example.com,DNS:private.example.com,DNS:redirect.example.com\nextendedKeyUsage=serverAuth\n');
 openssl(['x509','-req','-in','receiver.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-days','1','-out','cert.pem','-extfile','receiver.ext']);
 const config={APP_ORIGIN:origin,SEED_SAMPLE_DATA:'false',FIRST_OWNER_EMAIL:'owner@egress.example',FIRST_OWNER_NAME:'Owner',WORKSPACE_NAME:'Native delivery proof',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Native',DEFAULT_TEAM_PREFIX:'NAT',MAIL_MODE:'local-outbox',MAIL_FROM:'Vector <signin@example.com>',SESSION_SECRET:'local-only-egress-proof-secret-at-least-32-characters'};
 worker=await waveBWorker(origin,config,resolve('evidence/outbound-native'));
 const proxyOptions={configPath:join(worker.state,'wrangler.json'),persist:{path:join(worker.state,'v3')},remoteBindings:false};
 proxy=await getPlatformProxy(proxyOptions);
 const db=proxy.env.DB,env={...proxy.env,...config};
 const call=(path,method='GET',body,cookie='')=>fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal((await call('/auth/request','POST',{email:env.FIRST_OWNER_EMAIL})).status,202);
 const mail=await db.prepare("SELECT json_extract(message,'$.text') AS text FROM rer_mail_development_outbox ORDER BY sequence DESC LIMIT 1").first(),token=new URL(mail.text.match(/https?:\/\/[^\s]+/)[0]).searchParams.get('token');
 const confirmed=await call('/auth/confirm','POST',{token});assert.equal(confirmed.status,303);const cookie=confirmed.headers.get('set-cookie').split(';')[0];
 assert.equal((await call('/api/setup/complete','POST',{confirmed:true},cookie)).status,200);
 const registered=await call('/api/settings/integrations/destinations','POST',{name:'Loopback receiver',url:'https://receiver.example.com/events'},cookie);assert.equal(registered.status,201);const destination=await registered.json();
 const key=Buffer.from(destination.secret,'hex'),cert=await readFile(join(work,'cert.pem')),seen=new Map(),hosts=[];let received=0,mode='accepted',receiverNow=Date.now();
 receiver=createServer({key:await readFile(join(work,'key.pem')),cert},async(request,response)=>{
  const chunks=[];for await(const chunk of request)chunks.push(chunk);hosts.push(request.headers.host);
  if(request.headers.host==='redirect.example.com'){response.writeHead(302,{location:'https://receiver.example.com/events'}).end();return;}const body=Buffer.concat(chunks).toString('utf8'),headers=request.headers;
  const data=JSON.stringify(['integrations.webhook.v1',headers['webhook-tenant'],headers['webhook-destination'],headers['webhook-event'],headers['webhook-id'],headers['webhook-timestamp'],body]),expected=createHmac('sha256',key).update(data).digest(),provided=Buffer.from(String(headers['webhook-signature']??'').slice(3),'hex');
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected)||!Number.isFinite(Number(headers['webhook-timestamp']))||Math.abs(receiverNow-Number(headers['webhook-timestamp'])*1000)>300000){response.writeHead(401).end();return;}
  proof.hmacVerified=true;const previous=seen.get(headers['webhook-id']);if(previous&&previous!==body){response.writeHead(409).end();return;}
  if(mode==='retry'){response.writeHead(429,{'retry-after':'1'}).end();return;}
  if(!previous){seen.set(headers['webhook-id'],body);received++;}
  if(mode==='uncertain'){request.socket.destroy();return;}response.writeHead(204).end();
 });
 await new Promise(resolve=>receiver.listen(0,'127.0.0.1',resolve));const port=receiver.address().port;
 // private.example.com resolves to one public and one loopback address: the service refuses before any connect.
 const transport=createDevEgress({receivers:{'receiver.example.com':{port},'redirect.example.com':{port},'private.example.com':{port,answers:['1.1.1.1','127.0.0.1']}},openSocket:nodeLoopbackSockets(),tls:await testTls(await readFile(join(work,'ca.pem')))});
 env.INTEGRATION_EGRESS=transport;env.INTEGRATION_EGRESS_POLICY='public-dns-pinned-tls-v1';
 const admin=await(await call('/api/settings/administration','GET',undefined,cookie)).json(),team=admin.teams[0];
 const retained=await(await call('/api/settings/integrations','GET',undefined,cookie)).json(),retainedDestination=retained.destinations.find(row=>row.id===destination.id);assert(retainedDestination);
 const created=await call('/api/issues','POST',{teamId:team.id,title:'Native queued event'},cookie);assert.equal(created.status,201);proof.nativeQueue=true;
 await dispatchWebhooks(env);const delivery=await db.prepare('SELECT id,envelope,state FROM integration_deliveries ORDER BY created_at LIMIT 1').first();assert.equal(delivery.state,'accepted');assert.equal(received,1);
 const service=outboundService(env,admin.workspace.id),envelope=JSON.parse(delivery.envelope),protocol=(await import('../../../vendor/base/integrations/core/webhook.ts')).createWebhookProtocol({resolveDestination:async()=>retainedDestination.url,signingKey:async()=>new Uint8Array(key)}),wire=await protocol.prepare(envelope,Date.now());
 assert.equal((await transport.send(wire)).status,204);assert.equal(received,1);assert.equal((await transport.send({...wire,body:wire.body+' '})).status,401);proof.replaySafe=true;
 mode='uncertain';await call('/api/issues','POST',{teamId:team.id,title:'Lost receiver acknowledgement'},cookie);await dispatchWebhooks(env);const unknown=await db.prepare("SELECT id FROM integration_deliveries WHERE state='uncertain'").first();assert(unknown);const attempts=transport.connects.length;await dispatchWebhooks(env);assert.equal(transport.connects.length,attempts);proof.uncertain=true;
 mode='retry';await call('/api/issues','POST',{teamId:team.id,title:'Rate-limited receiver'},cookie);await dispatchWebhooks(env);let pending=await db.prepare("SELECT id,next_at,max_attempts,attempts FROM integration_deliveries WHERE state='queued'").first();assert(pending);
 for(let i=0;i<pending.max_attempts;i++){receiverNow=pending.next_at+1;await outboundService(env,admin.workspace.id,()=>receiverNow).dispatch(pending.id);pending=await db.prepare('SELECT id,next_at,max_attempts,attempts,state FROM integration_deliveries WHERE id=?').bind(pending.id).first();if(pending.state!=='queued')break;}
 assert.equal(pending.state,'rejected');assert.equal(pending.attempts,pending.max_attempts);proof.retryBounded=true;
 // Through Vector's own door: a destination whose name resolves to a private address, and one
 // that answers with a redirect. Neither is followed; each delivery is held as uncertain.
 const add=async(name,url)=>{const added=await call('/api/settings/integrations/destinations','POST',{name,url},cookie);assert.equal(added.status,201);return added.json();};
 const revoke=async id=>assert.equal((await call('/api/settings/integrations/destinations/'+id,'DELETE',undefined,cookie)).status,200);
 const latest=id=>db.prepare("SELECT d.state,a.outcome FROM integration_deliveries d JOIN integration_attempts a ON a.namespace=d.namespace AND a.delivery_id=d.id WHERE json_extract(d.envelope,'$.destinationId')=? ORDER BY a.number DESC LIMIT 1").bind(id).first();
 mode='accepted';await revoke(destination.id);const privateDestination=await add('Private address','https://private.example.com/events'),privateConnects=transport.connects.length,privateHosts=hosts.length;
 assert.equal((await call('/api/issues','POST',{teamId:team.id,title:'Private destination'},cookie)).status,201);await dispatchWebhooks(env);
 const privateDelivery=await latest(privateDestination.id);assert.equal(privateDelivery.state,'uncertain');assert.equal(transport.connects.length,privateConnects);assert.equal(hosts.length,privateHosts);
 await assert.rejects(transport.send({...wire,url:'https://private.example.com/events'}),/egress_dns_not_public/);assert.equal(transport.connects.length,privateConnects);proof.privateDnsRefused=true;
 await revoke(privateDestination.id);const redirectDestination=await add('Redirecting receiver','https://redirect.example.com/events'),before=hosts.length;
 assert.equal((await call('/api/issues','POST',{teamId:team.id,title:'Redirecting destination'},cookie)).status,201);await dispatchWebhooks(env);
 const redirected=await latest(redirectDestination.id);assert.equal(redirected.state,'uncertain');assert.equal(JSON.parse(redirected.outcome).status,302);assert.deepEqual(hosts.slice(before),['redirect.example.com']);proof.redirectNotFollowed=true;
 assert.equal((await service.get(delivery.id)).state,'accepted');assert.equal((await service.get(unknown.id)).state,'uncertain');assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
 await proxy.dispose();proxy=await getPlatformProxy(proxyOptions);
 const restarted=outboundService({...env,DB:proxy.env.DB,FILES:proxy.env.FILES},admin.workspace.id);assert.equal((await restarted.get(delivery.id)).state,'accepted');assert.equal((await restarted.get(unknown.id)).state,'uncertain');assert.equal((await restarted.get(pending.id)).state,'rejected');proof.restarted=true;proof.passed=true;
}finally{
 await new Promise(resolve=>{if(receiver){receiver.closeAllConnections();receiver.close(resolve);}else resolve();});await proxy?.dispose();await worker?.stop();await rm(work,{recursive:true,force:true});
 await mkdir(resolve('evidence'),{recursive:true});await writeFile(resolve('evidence/outbound-loopback.json'),JSON.stringify(proof,null,2)+'\n');
}
console.log('Native queue and Base egress-service loopback proof passed.');
