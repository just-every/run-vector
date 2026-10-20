import {vi,expect} from 'vitest';
export function channelEdge(){
 const token=['synthetic','slack',crypto.randomUUID()].join('-'),webhook='https://discord.com/api/webhooks/123/'+crypto.randomUUID();
 const calls:{method:string;body:any;redirect:RequestRedirect|undefined}[]=[];
 let createError:string|null=null,postMode='accepted';
 const network=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(String(input));const body=JSON.parse(String(init?.body??'{}'));
  expect(init?.redirect).toBe('manual');
  const method=url.host==='slack.com'?url.pathname.slice(5):'discord';
  calls.push({method,body,redirect:init?.redirect});
  if(method==='auth.test')return Response.json({ok:true,team:'Fixture workspace',bot_id:'BOT'});
  if(method==='conversations.create')return Response.json(createError?{ok:false,error:createError}:{ok:true,channel:{id:'CFIXTURE',name:body.name}});
  if(method==='chat.postMessage'){
   expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer '+token);
   if(postMode==='uncertain')throw Error('Lost provider acknowledgement');
   if(postMode==='redirect')return new Response(null,{status:302,headers:{Location:'https://forbidden.example.test'}});
   if(postMode==='retry')return new Response(null,{status:429,headers:{'Retry-After':'1'}});
   return Response.json({ok:true,ts:'123.456'});
  }
  if(method==='discord'){expect(url.href).toBe(webhook);return postMode==='redirect'?new Response(null,{status:302,headers:{Location:'https://forbidden.example.test'}}):new Response(null,{status:204});}
  throw Error('Unexpected network edge '+url.hostname+url.pathname);
 });
 return {token,webhook,calls,restore:()=>network.mockRestore(),createError:(value:string|null)=>{createError=value;},postMode:(value:string)=>{postMode=value;}};
}
