import { env } from 'cloudflare:workers';
import { bindings, origin } from './base-auth-fixture';
import { agentResponse } from '../../src/core/features/agent-door/runtime';

/** A signed issuer fixture, never an external account or retained private key. */
export async function suspensionAgentFixture(member:string,email:string) {
  const pair = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const issuer='https://synthetic-vector-9360.example.test';
  const current={...bindings,RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:'synthetic-vector-9361',
    RER_OWNER_CLAIM_APP_ORIGIN:origin,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify({fixture:await crypto.subtle.exportKey('jwk',pair.publicKey)})};
  await env.DB.batch([
    env.DB.prepare("INSERT INTO bs_settings(singleton,owner_id) VALUES(1,'synthetic-vector-9362') ON CONFLICT(singleton) DO UPDATE SET owner_id=excluded.owner_id"),
    env.DB.prepare("INSERT INTO bs_team(email,operator_id,invite,state,business_id,business_role) VALUES(?,?,1,'active','synthetic-vector-9363','member')").bind(email,member),
  ]);
  const encode=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');
  const body=(value:unknown)=>encode(new TextEncoder().encode(JSON.stringify(value)));
  const issuedAt=Math.floor(Date.now()/1000);
  const credential=async(agent:string,iat=issuedAt)=>{
    const input=body({alg:'ES256',typ:'at+jwt',kid:'fixture'})+'.'+body({iss:issuer,aud:origin+'/mcp',sub:'synthetic-vector-9363',email,
      act:{sub:agent,name:agent},client_id:'synthetic-vector-9364',business:'synthetic-vector-9365',jti:crypto.randomUUID(),scope:'issues:read',consent:'synthetic-vector-9366',iat,exp:iat+900});
    return input+'.'+encode(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(input))));
  };
  const call=async(token:string)=>{
    const method=['tools','list'].join('/');
    const response=await agentResponse(current,new Request(origin+'/mcp',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,
      'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':method},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:{}})}));
    const status=response!.status;await response!.arrayBuffer();return status;
  };
  return {credential,call,issuedAt};
}
