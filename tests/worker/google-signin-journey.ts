import {env} from 'cloudflare:workers'
import {applyD1Migrations} from 'cloudflare:test'
import {readArchive} from '@runeditrun/rer/modules/portability'
import {expect,inject,vi} from 'vitest'
import {actor,bindings,invite,mailToken,origin,request,signIn} from './base-auth-fixture'
import {googleAddress,googleEdge} from '../e2e/google-oidc-edge'
import {createServerApp} from '../../src/core/app/server'
import {createVectorArchive} from '../../src/core/features/data/archive-service.mjs'

export async function googleSignInJourney(ownerCookie:string) {
  const edge=await googleEdge(),app=createServerApp()
  const configPath='/api/settings/sign-in/google'
  const call=(path:string,method='GET',cookie='',body?:unknown,headers:Record<string,string>={})=>app.request(origin+path,{method,headers:{host:new URL(origin).host,origin,cookie,'content-type':'application/json','CF-Connecting-IP':'192.0.2.19',...headers},body:body===undefined?undefined:JSON.stringify(body)},bindings)
  const snapshot=async()=>JSON.stringify((await env.DB.batch(['operators','oa_operators','oa_sessions','oa_external_identities','oa_tokens','vector_google_configuration','audit_records'].map(t=>env.DB.prepare('SELECT * FROM '+t+' ORDER BY rowid')))).map(r=>r.results))
  const save=()=>call(configPath,'PUT',ownerCookie,{clientId:edge.clientId,clientSecret:edge.clientSecret})
  const spy=vi.spyOn(globalThis,'fetch').mockImplementation(edge.fetch)
  try {
    const admin=await invite(googleAddress(11),ownerCookie,'admin')
    const initial=await snapshot()
    expect((await call(configPath,'PUT',admin,{clientId:edge.clientId,clientSecret:edge.clientSecret})).status).toBe(403)
    expect((await call(configPath,'PUT','',{clientId:edge.clientId,clientSecret:edge.clientSecret})).status).toBe(401)
    expect((await call(configPath,'PUT','operator_session_local_15920=synthetic-vector-foreign',{clientId:edge.clientId,clientSecret:edge.clientSecret})).status).toBe(401)
    expect((await call(configPath,'PUT',ownerCookie,{clientId:edge.clientId,clientSecret:edge.clientSecret},{origin:'https://foreign.example.test'})).status).toBe(403)
    expect(await snapshot()).toBe(initial)
    expect((await save()).status).toBe(200)
    const settings=await (await call(configPath,'GET',ownerCookie)).json() as {redirectUri:string;javascriptOrigin:string}
    expect(settings.redirectUri).toBe(origin+'/auth/oidc/google/callback');expect(settings.javascriptOrigin).toBe(origin)
    expect(JSON.stringify(settings)).not.toContain(edge.clientSecret)
    expect((await call(configPath+'/enabled','POST',ownerCookie,{enabled:true})).status).toBe(409)
    const begin=async(test=false,cookie='')=>{
      const response=await call('/auth/oidc/google/'+(test?'test':'start'),'POST',cookie,{returnTo:'/app'})
      expect(response.status).toBe(303)
      return {location:response.headers.get('location')!,cookie:[cookie,response.headers.get('set-cookie')!.split(';')[0]].filter(Boolean).join('; ')}
    }
    const ownerEmail=(await env.DB.prepare('SELECT email FROM operators WHERE id=?').bind(await actor(ownerCookie)).first<{email:string}>())!.email
    let start=await begin(true,ownerCookie)
    let callback=edge.code(start.location,ownerEmail)
    expect((await call(callback,'GET',start.cookie)).status).toBe(303)
    expect((await call(configPath+'/enabled','POST',ownerCookie,{enabled:true})).status).toBe(200)
    const beforeAuth=(await env.DB.prepare('SELECT * FROM oa_auth_settings').all()).results
    const memberEmail=googleAddress(12)
    expect((await request('/api/settings/operators/invite','POST',{email:memberEmail,displayName:'Google member'},ownerCookie)).status).toBe(202)
    const invited=await env.DB.prepare('SELECT id,status FROM oa_operators WHERE email=?').bind(memberEmail).first<{id:string;status:string}>()
    expect(invited?.status).toBe('invited')
    start=await begin();callback=edge.code(start.location,memberEmail)
    const confirmed=await call(callback,'GET',start.cookie)
    expect(confirmed.status,await confirmed.clone().text()).toBe(303)
    const memberCookie=confirmed.headers.get('set-cookie')!.split(', ').at(-1)!.split(';')[0]
    const memberId=await actor(memberCookie)
    expect((await env.DB.prepare('SELECT auth_id FROM vector_auth_operators WHERE operator_id=?').bind(memberId).first())?.auth_id).toBe(invited!.id)
    await env.DB.prepare('DELETE FROM access_rate_limits').run()
    const same=await signIn(memberEmail);expect(await actor(same)).toBe(memberId)
    expect((await env.DB.prepare('SELECT count(*) n FROM operators WHERE email=?').bind(memberEmail).first())?.n).toBe(1)
    expect((await env.DB.prepare('SELECT * FROM oa_auth_settings').all()).results).toEqual(beforeAuth)
    // Correlation failures never bind, issue a session, consume an invitation or audit a sign-in.
    const refuse=async(claims:Record<string,unknown>,email=memberEmail,corrupt?:'state'|'binding'|'missing-state'|'missing-binding')=>{
      const started=await begin();let path=edge.code(started.location,email,claims),cookie=started.cookie
      if(corrupt==='state') path=path.replace(/state=[^&]+/,'state='+'x'.repeat(43))
      if(corrupt==='binding') cookie=cookie.replace(/=[^=]+$/,'='+'x'.repeat(43))
      if(corrupt==='missing-state') path=path.replace(/&state=[^&]+/,'')
      if(corrupt==='missing-binding') cookie=''
      const before=await snapshot(),result=await call(path,'GET',cookie)
      expect(result.status).toBeGreaterThanOrEqual(400)
      expect(result.headers.get('set-cookie')??'').not.toContain('operator_session_')
      expect(await snapshot()).toBe(before)
    }
    for(const claims of [{email_verified:false},{iss:'https://wrong.example.test'},{aud:'synthetic-vector-other'},{nonce:'synthetic-vector-other'}]) await refuse(claims)
    await refuse({},googleAddress(99))
    for(const corrupt of ['state','binding','missing-state','missing-binding'] as const) await refuse({},memberEmail,corrupt)
    const beforeReplay=await snapshot()
    expect((await call(callback,'GET',start.cookie)).status).toBe(400)
    expect(await snapshot()).toBe(beforeReplay)
    // Current authority is checked after the external code exchange too.
    start=await begin();callback=edge.code(start.location,memberEmail)
    edge.setHook(async()=>{await env.DB.prepare('UPDATE operators SET removed_at=? WHERE id=?').bind(new Date().toISOString(),memberId).run()})
    expect((await call(callback,'GET',start.cookie)).status).toBe(403)
    edge.setHook()
    expect((await request('/api/session','GET',undefined,memberCookie)).status).toBe(401)
    const second=await invite(googleAddress(13),ownerCookie)
    start=await begin();callback=edge.code(start.location,googleAddress(13))
    edge.setHook(async()=>{expect((await call(configPath+'/enabled','POST',ownerCookie,{enabled:false})).status).toBe(200)})
    expect((await call(callback,'GET',start.cookie)).status).toBe(403)
    edge.setHook()
    expect((await request('/api/session','GET',undefined,second)).status).toBe(200)
    expect((await request('/api/session','GET',undefined,ownerCookie)).status).toBe(200)
    const archive=await createVectorArchive({db:env.DB,files:env.FILES}),exported=await archive.exports.create()
    while((await archive.exports.advance(exported,{maxParts:16})).phase==='building') {}
    const records:any[]=[]
    for await(const record of readArchive(await archive.exports.download(exported))) records.push(record)
    await archive.exports.abort(exported)
    const wire=JSON.stringify(records)
    expect(wire.includes(edge.clientSecret)).toBe(false)
    const tables=records.filter(r=>r.kind==='part').flatMap(r=>r.items).filter(r=>r.kind==='row').map(r=>r.table)
    expect(tables).not.toContain('vector_google_configuration')
    expect(tables).not.toContain('vector_google_sessions')
    const target=env as unknown as {ARCHIVE_TARGET_DB:D1Database;ARCHIVE_TARGET_FILES:R2Bucket}
    await applyD1Migrations(target.ARCHIVE_TARGET_DB,inject('migrations'))
    const destination=await createVectorArchive({db:target.ARCHIVE_TARGET_DB,files:target.ARCHIVE_TARGET_FILES})
    const restored=await destination.imports.create(records[0])
    for(const part of records.filter(r=>r.kind==='part')) await destination.imports.uploadPart(restored,part.index,part)
    await destination.imports.finalize(restored,{contentHash:records.at(-1).contentHash,archiveHash:records.at(-1).archiveHash})
    expect((await target.ARCHIVE_TARGET_DB.prepare('SELECT count(*) n FROM vector_google_configuration').first())?.n).toBe(0)
    expect((await target.ARCHIVE_TARGET_DB.prepare('SELECT count(*) n FROM oa_sessions').first())?.n).toBe(0)
    expect((await target.ARCHIVE_TARGET_DB.prepare('SELECT id FROM operators WHERE id=?').bind(memberId).first())?.id).toBe(memberId)
    for(const email of [googleAddress(11),googleAddress(13)]) {
      const person=await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind(email).first<{id:string}>()
      expect((await request('/api/settings/operators/'+person!.id,'DELETE',undefined,ownerCookie)).status).toBe(200)
    }
    expect((await env.DB.prepare('SELECT secret,transaction_secret FROM vector_google_configuration').first())?.secret).not.toBe(edge.clientSecret)
    console.log('PROBE ROLE-010 Google configure, test, enable, signed invitation, stable identity, magic link, protocol refusals, Owner authority, withdrawal and archive custody: passed')
  } finally {spy.mockRestore()}
}
