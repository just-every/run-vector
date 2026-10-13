import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { expect,inject,it } from 'vitest';
import { bindings,request } from './base-auth-fixture';

const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
it('[OWNER-CLAIM-001] signed native admission binds trusted configuration, rolls back invalid claims and permanently refuses a second claim',async()=>{
  await applyD1Migrations(env.DB,inject('migrations'));
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey),now=Math.floor(Date.now()/1000);
  const config={SETUP_TOKEN:'test-only-hidden-setup-token-with-32-bytes',RER_OWNER_CLAIM_ISSUER:'https://management.example.test',RER_OWNER_CLAIM_INSTALLATION_ID:'vector-test',RER_OWNER_CLAIM_APP_ORIGIN:bindings.APP_ORIGIN,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify({current:publicKey})};
  const token=async(change:Record<string,unknown>={},kid='current')=>{
    const header=encode(new TextEncoder().encode(JSON.stringify({alg:'ES256',typ:'rer-owner-claim+jwt',kid})));
    const payload=encode(new TextEncoder().encode(JSON.stringify({v:1,iss:config.RER_OWNER_CLAIM_ISSUER,aud:bindings.APP_ORIGIN,installationId:'vector-test',email:bindings.FIRST_OWNER_EMAIL,jti:crypto.randomUUID(),iat:now,exp:now+300,...change})));
    const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(header+'.'+payload));
    return header+'.'+payload+'.'+encode(new Uint8Array(signature));
  };
  const untouched=async()=>{
    for(const table of ['oa_operators','oa_sessions','oa_limits','oa_bootstrap','oc_owner_claims','workspace_settings','operators'])
      expect((await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first())?.n).toBe(0);
  };
  expect((await request('/health','GET',undefined,'',config)).status).toBe(200);await untouched();
  const preview=await request('/auth/owner-claim','GET',undefined,'',config);
  expect(preview.status).toBe(200);expect(preview.headers.get('set-cookie')).toBeNull();expect(preview.headers.get('cache-control')).toContain('no-store');await untouched();
  for(const change of [{email:'uninvited@example.test'},{aud:'https://foreign.example.test'},{iss:'https://foreign.example.test'},{installationId:'foreign'},{exp:now-1},{iat:now+3600,exp:now+3900}]) {
    expect((await request('/auth/owner-claim','POST',{token:await token(change)},'',config)).status, 'Rejected claim fields: '+Object.keys(change).join(',')).toBe(403);await untouched();
  }
  expect((await request('/auth/owner-claim','POST',{token:await token({},'unknown')},'',config)).status).toBe(403);await untouched();
  const signed=await token();
  expect((await request('/auth/owner-claim','POST',{token:signed},'',{...config,RER_OWNER_CLAIM_PUBLIC_KEYS:undefined})).status).toBe(503);await untouched();
  const responses=await Promise.all([request('/auth/owner-claim','POST',{token:signed,returnTo:'/app'},'',config),request('/auth/owner-claim','POST',{token:await token(),returnTo:'/app'},'',config)]);
  expect(responses.map(response=>response.status).sort()).toEqual([303,409]);
  const success=responses.find(response=>response.status===303)!,cookie=success.headers.get('set-cookie')!.split(';')[0];
  expect(success.headers.get('location')).toBe('/setup');
  expect((await request('/api/session','GET',undefined,cookie,config)).status).toBe(200);
  for(const table of ['oa_operators','oa_sessions','oa_bootstrap','oc_owner_claims','workspace_settings','operators','vector_auth_operators'])
    expect((await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first())?.n).toBe(1);
  const before=await env.DB.prepare('SELECT count(*) AS n FROM oa_limits').first();
  expect((await request('/auth/owner-claim','POST',{token:await token()},'',config)).status).toBe(409);
  expect(await env.DB.prepare('SELECT count(*) AS n FROM oa_limits').first()).toEqual(before);
  expect(JSON.stringify((await env.DB.prepare('SELECT * FROM oc_owner_claims').all()).results)).not.toContain(signed);
});
