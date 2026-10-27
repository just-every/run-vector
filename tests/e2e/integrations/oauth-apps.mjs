import {jsonMediaType,formMediaType} from '../../../src/core/features/oauth-apps/media-types.ts';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {roleScreens} from '../role-ui-support.mjs';
import {openAuthenticatedPage} from '../ui-runtime-auth.mjs';
import {confirmLink,readDevelopmentLink} from '../outbox-session.mjs';
import {navigate,settleReads,trackRequests} from '../collaboration-navigation.mjs';

/** The network-edge client owns only generated credentials held in memory. */
export async function exerciseOAuthApps({page,runtime,cookie,evidence}){
 const inspect=roleScreens(evidence),name='synthetic-vector-4541',redirect=runtime.base+'/oauth-test-client/callback';
 const headers={Cookie:cookie,Origin:runtime.base,'Content-Type':jsonMediaType};
 const call=async(path,method='GET',body,status=200)=>{const r=await runtime.req('/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,status);return r.json();};
 const person=async(n,role)=>{
  const email='synthetic-vector-'+n+'@vector.test';await call('/settings/operators/invite','POST',{email,displayName:'synthetic-vector-'+n,role},202);
  const link=await readDevelopmentLink(runtime.base,runtime.req,email,runtime.state),confirmed=await confirmLink(link);assert.equal(confirmed.status,303);
  return confirmed.headers.get('set-cookie').split(';')[0];
 };
 const memberCookie=await person(4542,'member'),adminCookie=await person(4543,'admin');
 await page.setViewportSize({width:1440,height:1000});trackRequests(page);await navigate(page,runtime.base+'/app/settings#oauth-apps');
 const panel=page.getByRole('region',{name:'OAuth apps',exact:true});await panel.getByRole('heading',{name:'Registered applications',exact:true}).waitFor();
 await panel.getByLabel('Application name',{exact:true}).fill(name);await panel.getByLabel('Redirect URLs',{exact:true}).fill(redirect);
 await panel.getByRole('checkbox',{name:'issues:write',exact:true}).check();await panel.getByRole('checkbox',{name:'metadata:read',exact:true}).check();
 const created=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/oauth-apps'&&r.request().method()==='POST');await panel.getByRole('button',{name:'Register application',exact:true}).click();const receipt=await created;assert.equal(receipt.status(),201);const client=await receipt.json();
 const secret=panel.getByLabel('New credential',{exact:true});await secret.waitFor();assert.equal(await secret.getAttribute('type'),'password');assert.equal(await secret.inputValue()===client.secret,true);
 await panel.getByRole('button',{name:'Show credential',exact:true}).click();assert.equal(await secret.getAttribute('type'),'text');await panel.getByRole('button',{name:'Hide credential',exact:true}).click();await panel.getByRole('button',{name:'I saved it; close',exact:true}).click();assert.equal(await secret.count(),0);
 await panel.getByLabel(name+' client ID',{exact:true}).waitFor();await panel.getByText('Permissions: issues:read, issues:write, metadata:read',{exact:true}).waitFor();await inspect(page,panel,'oauth-apps');await page.reload();await panel.getByLabel(name+' client ID',{exact:true}).waitFor();assert.equal(await secret.count(),0);assert.equal((await page.content()).includes(client.secret),false);
 const member=await openAuthenticatedPage(page.context().browser(),memberCookie,runtime.base),admin=await openAuthenticatedPage(page.context().browser(),adminCookie,runtime.base);
 try{
  await member.setViewportSize({width:1440,height:1000});trackRequests(member);await navigate(member,runtime.base+'/app/settings');assert.equal(await member.getByRole('button',{name:'Register application',exact:true}).count(),0);
  const verifier=randomBytes(32).toString('hex'),challenge=createHash('sha256').update(verifier).digest('base64url'),state='synthetic-vector-4544';
  const query=new URLSearchParams({response_type:'code',client_id:client.id,redirect_uri:redirect,scope:'issues:read',state,code_challenge:challenge,code_challenge_method:'S256'});
  await navigate(member,runtime.base+'/api/oauth/authorize?'+query);await settleReads(member);assert.equal(new URL(member.url()).pathname,'/app/settings/oauth-consent');assert.deepEqual(await member.getByRole('alert').allTextContents(),[],'The consent request loads without an authorization error');const consent=member.getByRole('region',{name:'Authorize an application',exact:true});await consent.getByRole('heading',{name,exact:true}).waitFor();await consent.getByText('issues:read',{exact:true}).waitFor();await inspect(member,consent,'oauth-consent');await member.setViewportSize({width:1440,height:1000});
  await Promise.all([member.waitForURL(url=>url.pathname==='/oauth-test-client/callback'),consent.getByRole('button',{name:'Approve access',exact:true}).click()]);
  const returned=new URL(member.url());assert.equal(returned.searchParams.get('state'),state);const code=returned.searchParams.get('code');assert.ok(code);
  const exchange=await runtime.req('/api/oauth/token',{method:'POST',headers:{'Content-Type':formMediaType},body:new URLSearchParams({grant_type:'authorization_code',client_id:client.id,client_secret:client.secret,code,redirect_uri:redirect,code_verifier:verifier})});assert.equal(exchange.status,200);const token=await exchange.json();
  const api=(path,method='GET',body)=>runtime.req('/api/v1'+path,{method,headers:{Authorization:'Bearer '+token.access_token,'Content-Type':jsonMediaType},body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await api('/issues')).status,200);
  const before=runtime.sql('SELECT COUNT(*) AS n FROM issues')[0].n;
  const team=runtime.sql('SELECT id FROM teams ORDER BY created_at LIMIT 1')[0].id;assert.equal((await api('/issues','POST',{teamId:team,title:'synthetic-vector-4545'})).status,403);assert.equal(runtime.sql('SELECT COUNT(*) AS n FROM issues')[0].n,before);
  trackRequests(admin);await navigate(admin,runtime.base+'/app/settings#oauth-apps');const inventory=admin.getByRole('region',{name:'Authorized grants',exact:true});await inventory.getByText('issues:read',{exact:true}).waitFor();const revoke=inventory.getByRole('button',{name:'Revoke '+name+' for synthetic-vector-4542',exact:true});await revoke.waitFor();await inspect(admin,inventory,'oauth-grants');
  const revoked=admin.waitForResponse(r=>r.request().method()==='DELETE'&&new URL(r.url()).pathname==='/api/settings/oauth-apps/grants/'+token.grant_id);await revoke.click();assert.equal((await revoked).status(),200);await inventory.getByText('Revoked',{exact:true}).waitFor();assert.equal((await api('/issues')).status,401);
  await settleReads(admin);
 }finally{await member.context().close();await admin.context().close();}
 console.log('API-004 browser authorization, read-only scope and next-call revocation passed; three screens captured at 1440 and 390.');
}

/** Seed and check the same archive door without retaining credentials in evidence. */
export async function seedOAuthArchive(installation,cookie){
 const call=async(path,body,status)=>{const r=await installation.req(path,'POST',body,cookie);assert.equal(r.status,status);return r.json();};
 const redirect=installation.origin+'/oauth-test-client/callback';
 const client=await call('/api/settings/oauth-apps',{name:'synthetic-vector-4551',redirectUris:[redirect],scopes:['issues:read']},201);
 const request={response_type:'code',client_id:client.id,redirect_uri:redirect,scope:'issues:read',state:'synthetic-vector-4552'};
 const member=await installation.signIn('maya@vector.test');
 const approval=await installation.req('/api/oauth/consent','POST',{request,decision:'approve'},member);assert.equal(approval.status,200);const consent=await approval.json();
 const token=await call('/api/oauth/token',{grant_type:'authorization_code',client_id:client.id,client_secret:client.secret,code:new URL(consent.redirect).searchParams.get('code'),redirect_uri:redirect},200);
 assert.equal((await installation.req('/api/v1/issues','GET',undefined,'',{Authorization:'Bearer '+token.access_token})).status,200);
 assert.equal(installation.sql('SELECT COUNT(*) AS n FROM vector_oauth_apps')[0].n,1);assert.equal(installation.sql('SELECT COUNT(*) AS n FROM vector_oauth_grants')[0].n,1);
 const namespace=installation.sql('SELECT namespace FROM vector_oauth_grants')[0].namespace;
 const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
 const rows=query=>installation.sql(query).map(row=>({...row}));
 const history={
  vector_integration_tokens:rows('SELECT * FROM vector_integration_tokens WHERE namespace='+quote(namespace)),
  integration_token_usage:rows('SELECT * FROM integration_token_usage WHERE namespace='+quote(namespace)+' ORDER BY id'),
  audit_records:rows('SELECT * FROM audit_records WHERE subject_id IN ('+quote(client.id)+','+quote(token.grant_id)+') ORDER BY id'),
 };
 assert.equal(history.vector_integration_tokens.length,1);assert.equal(history.integration_token_usage.length,1);
 for(const action of ['oauth.app.registered','oauth.consent.approved','oauth.grant.issued'])assert(history.audit_records.some(row=>row.action===action),'Seeded OAuth audit action: '+action);
 return {token:token.access_token,history};
}
export async function verifyOAuthArchive(installation,cookie,fixture,records){
 assert.equal((await installation.req('/api/v1/issues','GET',undefined,'',{Authorization:'Bearer '+fixture.token})).status,401,'The restored installation refuses the pre-restore OAuth token');
 for(const table of ['vector_oauth_apps','vector_oauth_codes','vector_oauth_grants','integration_tokens']){
  assert.equal(records[0].tables.some(row=>row.name===table),false,'OAuth credential tables are excluded');assert.equal(installation.sql('SELECT COUNT(*) AS n FROM '+table)[0].n,0);
 }
 const rows=records.filter(row=>row.kind==='part').flatMap(part=>part.items).filter(item=>item.kind==='row');
 for(const [table,expected] of Object.entries(fixture.history)){
  const ids=new Set(expected.map(row=>row.id??row.token_id));
  assert.deepEqual(rows.filter(item=>item.table===table&&ids.has(item.row.id??item.row.token_id)).map(item=>item.row).sort((a,b)=>String(a.id??a.token_id).localeCompare(String(b.id??b.token_id))),expected.slice().sort((a,b)=>String(a.id??a.token_id).localeCompare(String(b.id??b.token_id))),'Archive retains the specific OAuth history: '+table);
  const restored=installation.sql('SELECT * FROM '+table).map(row=>({...row})).filter(row=>ids.has(row.id??row.token_id));
  assert.deepEqual(restored.sort((a,b)=>String(a.id??a.token_id).localeCompare(String(b.id??b.token_id))),expected.slice().sort((a,b)=>String(a.id??a.token_id).localeCompare(String(b.id??b.token_id))),'Restore retains the specific OAuth history: '+table);
 }
 // A restored member must authorize a freshly registered app before new authority exists.
 const redirect=installation.origin+'/oauth-test-client/callback';
 const registered=await installation.req('/api/settings/oauth-apps','POST',{name:'synthetic-vector-4553',redirectUris:[redirect],scopes:['issues:read']},cookie);assert.equal(registered.status,201,'Fresh registration after restore');const client=await registered.json();
 const member=await installation.signIn('maya@vector.test'),request={response_type:'code',client_id:client.id,redirect_uri:redirect,scope:'issues:read',state:'synthetic-vector-4554'};
 const screen=await installation.req('/api/oauth/consent?'+new URLSearchParams(request),'GET',undefined,member);assert.equal(screen.status,200);assert.deepEqual((await screen.json()).scopes,['issues:read']);
 const approved=await installation.req('/api/oauth/consent','POST',{request,decision:'approve'},member);assert.equal(approved.status,200,'Fresh member consent after restore');const consent=await approved.json();
 const exchanged=await installation.req('/api/oauth/token','POST',{grant_type:'authorization_code',client_id:client.id,client_secret:client.secret,code:new URL(consent.redirect).searchParams.get('code'),redirect_uri:redirect});assert.equal(exchanged.status,200);const token=await exchanged.json();assert.equal(token.scope,'issues:read');
 assert.equal((await installation.req('/api/v1/issues','GET',undefined,'',{Authorization:'Bearer '+token.access_token})).status,200,'Fresh restored OAuth grant reads through the public API');
 assert.equal((await installation.req('/api/v1/issues','GET',undefined,'',{Authorization:'Bearer '+fixture.token})).status,401,'Fresh consent never revives the old token');
 console.log('API-004 archive door excludes registration, codes and grants; specific OAuth history survives, the old token is refused and fresh member consent restores access.');
}
