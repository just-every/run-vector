import {env} from 'cloudflare:workers';
import {expect,vi} from 'vitest';
import {setupIntegrations} from './integration-fixture';
import {invite,request,bindings} from './base-auth-fixture';
export async function slackAppInstall(){
 const f=await setupIntegrations(),secret='synthetic-vector-'+crypto.randomUUID(),clientSecret='synthetic-vector-'+crypto.randomUUID(),configToken='synthetic-vector-'+crypto.randomUUID(),botToken='synthetic-vector-'+crypto.randomUUID();
 const calls:{method:string;body:any}[]=[];
 let denied=false;
 const edge=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(String(input));expect(url.origin).toBe('https://slack.com');expect(init?.redirect).toBe('manual');
  const method=url.pathname.slice(5),form=new Headers(init?.headers).get('content-type')?.startsWith('application/x-www-form-urlencoded');
  const body=form?Object.fromEntries(new URLSearchParams(String(init?.body))):JSON.parse(String(init?.body??'{}'));calls.push({method,body});
  if(method==='apps.manifest.create'){
   expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer '+configToken);
   if(denied)return Response.json({ok:false,error:'invalid_auth'});
   const manifest=JSON.parse(body.manifest);expect(manifest.oauth_config.redirect_urls).toEqual([bindings.APP_ORIGIN+'/api/integrations/slack/oauth/callback']);
   expect(manifest.oauth_config.scopes.bot).toContain('chat:write');
   return Response.json({ok:true,app_id:'synthetic-vector-2000',credentials:{client_id:'synthetic-vector-2001',client_secret:clientSecret,signing_secret:secret}});
  }
  if(method==='oauth.v2.access'){expect(body.client_secret).toBe(clientSecret);expect(body.redirect_uri).toBe(bindings.APP_ORIGIN+'/api/integrations/slack/oauth/callback');return Response.json({ok:true,token_type:'bot',app_id:'synthetic-vector-2000',scope:'chat:write,channels:manage,channels:read,im:write,users:read.email',access_token:botToken});}
  if(method==='auth.test'){expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer '+botToken);return Response.json({ok:true,team:'synthetic-vector-2002'});}
  if(method==='auth.revoke')return Response.json({ok:true,revoked:true});
  throw Error('Unexpected Slack installation edge '+method);
 });
 const read=async(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;};
 const callback=(state:string,cookie=f.cookie)=>f.app.request(bindings.APP_ORIGIN+'/api/integrations/slack/oauth/callback?state='+encodeURIComponent(state)+'&code=synthetic-vector-2003',{headers:{Cookie:cookie}},bindings);
 const begin=async()=>new URL((await read(await f.call('/settings/integrations/slack/app/install','POST',{}))).url).searchParams.get('state')!;
 try{
  // A Member cannot create, inspect credentials, or start an installation.
  const member=await invite('synthetic-vector-2004@vector.test',f.cookie),admin=await invite('synthetic-vector-2005@vector.test',f.cookie,'admin');
  for(const [path,method] of [['/slack/app','GET'],['/slack/app','POST'],['/slack/app/create','POST'],['/slack/app/install','POST']])expect((await request('/api/settings/integrations'+path,method,method==='GET'?undefined:{},member)).status).toBe(403);
  expect(calls).toHaveLength(0);
  const preview=await read(await f.call('/settings/integrations/slack/app'));
  expect(JSON.parse(new URL(preview.createUrl).searchParams.get('manifest_json')!)).toEqual(preview.manifest);
  expect(preview.app).toBeNull();
  await read(await f.call('/settings/integrations/slack/app/create','POST',{configurationToken:configToken}));
  const configured=await read(await f.call('/settings/integrations/slack/app'));
  expect(configured.app).toEqual({appId:'synthetic-vector-2000',clientId:'synthetic-vector-2001'});
  const stored=await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity LIKE 'slack-app:%'").all();
  expect(stored.results).toHaveLength(1);expect(JSON.stringify(stored)).not.toContain(clientSecret);expect(JSON.stringify(stored)).not.toContain(secret);expect(JSON.stringify(stored)).not.toContain(configToken);
  denied=true;await read(await f.call('/settings/integrations/slack/app/create','POST',{configurationToken:configToken}),400);denied=false;
  expect(await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity LIKE 'slack-app:%'").all()).toEqual(stored);
  const discarded=await begin(),current=await begin();
  expect((await callback(discarded)).status).toBe(403);
  expect((await callback(current,member)).status).toBe(403);
  expect((await callback(current,admin)).status).toBe(403);
  expect(calls.filter(c=>c.method==='oauth.v2.access')).toHaveLength(0);
  const installed=await callback(current);expect(installed.status,await installed.clone().text()).toBe(303);
  expect(installed.headers.get('Location')).toBe('/app/settings#integrations');
  expect((await read(await f.call('/settings/integrations/channels'))).slack).toMatchObject({connected:true,signingSecret:true});
  expect((await callback(current)).status).toBe(403);expect(calls.filter(c=>c.method==='oauth.v2.access')).toHaveLength(1);
  const all=(await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity LIKE 'slack%'").all()).results;
  expect(all).toHaveLength(3);expect(JSON.stringify(all)).not.toContain(botToken);expect(JSON.stringify(all)).not.toContain(clientSecret);expect(JSON.stringify(all)).not.toContain(secret);
  // The manual manifest path stores the same sealed profile, without a configuration token.
  await read(await f.call('/settings/integrations/slack/app','POST',{appId:'synthetic-vector-2000',clientId:'synthetic-vector-2001',clientSecret,signingSecret:secret}));
  await begin();await read(await f.call('/settings/integrations/slack','DELETE'));
  expect((await read(await f.call('/settings/integrations/slack/app'))).app).toBeNull();
  expect(await env.DB.prepare("SELECT count(*) n FROM vector_integration_secret_keys WHERE identity LIKE 'slack%'").first<number>('n')).toBe(0);
  expect(calls.filter(c=>c.method==='auth.revoke')).toHaveLength(1);
 }finally{edge.mockRestore();}
}
