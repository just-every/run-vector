import {vi,expect} from 'vitest';
export function channelEdge(installationTeam?:string){
 let app:{appId:string;clientId:string;clientSecret:string;signingSecret:string}|undefined;
 let token=['synthetic','slack',crypto.randomUUID()].join('-'),revoked=false;const webhook='https://discord.com/api/webhooks/123/'+crypto.randomUUID();
 const calls:{method:string;body:any;redirect:RequestRedirect|undefined}[]=[];
 let createError:string|null=null,postMode='accepted',safety:Record<string,unknown>={},lookupError:string|null=null;
 const users=new Map<string,{id:string;team_id:string;name:string;real_name:string;profile:{display_name:string;real_name:string}}>();
 const network=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(String(input));const body=init?.method==='GET'?Object.fromEntries(url.searchParams):new Headers(init?.headers).get('content-type')?.startsWith('application/x-www-form-urlencoded')?Object.fromEntries(new URLSearchParams(String(init?.body))):JSON.parse(String(init?.body??'{}'));
  expect(init?.redirect).toBe('manual');
  const method=url.host==='slack.com'?url.pathname.slice(5):'discord';
  calls.push({method,body,redirect:init?.redirect});
  if(app&&method==='apps.manifest.create')return Response.json({ok:true,app_id:app.appId,credentials:{client_id:app.clientId,client_secret:app.clientSecret,signing_secret:app.signingSecret}});
  if(app&&method==='oauth.v2.access')return Response.json({ok:true,app_id:app.appId,token_type:'bot',scope:'chat:write,channels:manage,channels:read,im:write,users:read.email',access_token:token});
  if(method==='auth.test')return Response.json(revoked?{ok:false,error:'token_revoked'}:{ok:true,team:'Fixture workspace',bot_id:'BOT',...(installationTeam?{team_id:installationTeam}:{})});
  if(method==='auth.revoke'){revoked=true;return Response.json({ok:true,revoked:true});}
  if(method==='conversations.info')return Response.json({ok:true,channel:{id:body.channel,name:'delivery',is_channel:true,is_member:true,is_archived:false,is_shared:false,is_ext_shared:false,is_org_shared:false,is_pending_ext_shared:false,...safety}});
  if(method==='users.lookupByEmail'){const user=users.get(body.email);return Response.json(lookupError?{ok:false,error:lookupError}:user?{ok:true,user}:{ok:false,error:'users_not_found'});}
  if(method==='conversations.open')return Response.json({ok:true,channel:{id:'D'+String(body.users).slice(1)}});
  if(method==='chat.update')return Response.json({ok:true,channel:body.channel,ts:body.ts});
  if(method==='conversations.create')return Response.json(createError?{ok:false,error:createError}:{ok:true,channel:{id:'CFIXTURE',name:body.name}});
  if(method==='chat.postMessage'){
   expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer '+token);
   if(postMode==='archived')return Response.json({ok:false,error:'is_archived'});
   if(postMode==='uncertain')throw Error('Lost provider acknowledgement');
   if(postMode==='redirect')return new Response(null,{status:302,headers:{Location:'https://forbidden.example.test'}});
   if(postMode==='retry')return new Response(null,{status:429,headers:{'Retry-After':'1'}});
   return Response.json({ok:true,ts:'123.456'});
  }
  if(method==='discord'){if(postMode==='uncertain')throw Error('Lost provider acknowledgement');expect(url.origin+url.pathname).toBe(webhook);expect(url.searchParams.get('wait')).toBe('true');return postMode==='redirect'?new Response(null,{status:302,headers:{Location:'https://forbidden.example.test'}}):Response.json({id:'fixture-message',content:body.content});}
  throw Error('Unexpected network edge '+url.hostname+url.pathname);
 });
 return {workspace:(value:string)=>{installationTeam=value;},app:(profile:{appId:string;clientId:string;clientSecret:string;signingSecret:string})=>{app=profile;},users:(email:string,id:string,name:string)=>{users.set(email,{id,team_id:'TFIXTURE',name:name.toLowerCase(),real_name:name+' Fixture',profile:{display_name:name,real_name:name+' Fixture'}});},lookupError:(value:string|null)=>{lookupError=value;},get token(){return token;},renew(){token=['synthetic','slack',crypto.randomUUID()].join('-');revoked=false;},webhook,calls,safety:(value:Record<string,unknown>={})=>{safety=value;},restore:()=>network.mockRestore(),createError:(value:string|null)=>{createError=value;},postMode:(value:string)=>{postMode=value;}};
}
