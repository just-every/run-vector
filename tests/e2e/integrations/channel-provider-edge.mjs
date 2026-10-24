// Synthetic Slack/Discord network edge for the built-Worker journey only.
import {appendFileSync,readFileSync} from 'node:fs';
export async function channelProviderEdge(request){
 const url=new URL(request.url);
 if(url.hostname==='api.sendgrid.com'&&url.pathname==='/v3/mail/send'){appendFileSync(process.env.VECTOR_CHANNEL_EDGE,JSON.stringify({method:'sendgrid',body:await request.json()})+'\n');return new Response(null,{status:202,headers:{'X-Message-Id':'synthetic-vector-'+crypto.randomUUID()}});}
 const body=request.method==='GET'?Object.fromEntries(url.searchParams):await request.json(),method=url.hostname==='slack.com'?url.pathname.slice(5):'discord';
 if(!['auth.test','auth.revoke','conversations.info','conversations.create','chat.postMessage','users.lookupByEmail','conversations.open','chat.update','discord'].includes(method))throw Error('Unexpected provider fixture endpoint');
 appendFileSync(process.env.VECTOR_CHANNEL_EDGE,JSON.stringify({method,body})+'\n');
 if(method==='auth.test')return Response.json({ok:true,team:'Delivery workspace'});
 if(method==='auth.revoke')return Response.json({ok:true,revoked:true});
 if(method==='conversations.info')return Response.json({ok:true,channel:{id:body.channel,name:'delivery',is_channel:true,is_member:true,is_archived:false,is_shared:false,is_ext_shared:false,is_org_shared:false,is_pending_ext_shared:false}});
 // The journey lists the Slack accounts that exist for an email; any other email has none.
 if(method==='users.lookupByEmail'){let users={};try{users=JSON.parse(readFileSync(process.env.VECTOR_CHANNEL_EDGE+'.users','utf8'));}catch{}return Response.json(users[body.email]?{ok:true,user:users[body.email]}:{ok:false,error:'users_not_found'});}
 if(method==='conversations.open')return Response.json({ok:true,channel:{id:'D'+String(body.users).slice(1)}});
 if(method==='chat.update')return Response.json({ok:true,channel:body.channel,ts:body.ts});
 if(method==='conversations.create')return Response.json({ok:true,channel:{id:'C'+body.name.replaceAll('-','').toUpperCase(),name:body.name}});
 if(method==='chat.postMessage')return Response.json(body.channel==='CREFUSED'?{ok:false,error:'not_in_channel'}:{ok:true,ts:'123.456'});
 if(!['discord.com','discordapp.com'].includes(url.hostname))throw Error('Unexpected fixture host');
 return Response.json({id:'fixture-message',content:body.content});
}
