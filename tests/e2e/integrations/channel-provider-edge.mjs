// Synthetic Slack/Discord network edge for the built-Worker journey only.
import {appendFileSync} from 'node:fs';
export async function channelProviderEdge(request){
 const url=new URL(request.url),body=await request.json(),method=url.hostname==='slack.com'?url.pathname.slice(5):'discord';
 if(!['auth.test','conversations.create','chat.postMessage','discord'].includes(method))throw Error('Unexpected provider fixture endpoint');
 appendFileSync(process.env.VECTOR_CHANNEL_EDGE,JSON.stringify({method,body})+'\n');
 if(method==='auth.test')return Response.json({ok:true,team:'Delivery workspace'});
 if(method==='conversations.create')return Response.json({ok:true,channel:{id:'C'+body.name.replaceAll('-','').toUpperCase(),name:body.name}});
 if(method==='chat.postMessage')return Response.json({ok:true,ts:'123.456'});
 if(!['discord.com','discordapp.com'].includes(url.hostname))throw Error('Unexpected fixture host');
 return new Response(null,{status:204});
}
