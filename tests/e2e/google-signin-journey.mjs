import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readdirSync} from 'node:fs'
import {dirname,join,resolve} from 'node:path'
import {unstable_getMiniflareWorkerOptions} from 'wrangler'
import {googleEdge,googleAddress} from './google-oidc-edge.ts'

/** The emitted application, real D1 and real browser. Only Google endpoints
 * are a fixture; no browser route manufactures an application response. */
export async function googleSignInRuntime(browser,{state,config,evidence}) {
  const require=createRequire(import.meta.url)
  const {Miniflare,convertV4MiniflareOptions}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'))
  const built=resolve('dist/server/wrangler.json'),root=dirname(built)
  const {workerOptions,main}=unstable_getMiniflareWorkerOptions(built),entry=resolve(root,main)
  const modules=readdirSync(root,{recursive:true}).filter(name=>/\.m?js$/.test(name)).map(name=>join(root,name))
    .sort((a,b)=>(b===entry)-(a===entry)).map(path=>({type:'ESModule',path}))
  const edge=await googleEdge(),origin=config.APP_ORIGIN
  const mf=new Miniflare(convertV4MiniflareOptions({rootPath:root,upstream:origin,resourcePersistencePath:resolve(state,'v3'),
    workers:[{name:'vector-local',modulesRoot:root,modules,...workerOptions,bindings:{...workerOptions.bindings,...config},
      outboundService:async request=>edge.fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),body:request.method==='POST'?await request.text():undefined,redirect:'manual'}),
    }],
  }))
  const contexts=[]
  try {
    await mf.ready
    const db=await mf.getD1Database('DB'),errors=[]
    const call=(path,method='GET',body,cookie='')=>mf.dispatchFetch(origin+path,{method,redirect:'manual',headers:{Host:new URL(origin).host,Origin:origin,'Content-Type':'application/json',Cookie:cookie,'CF-Connecting-IP':'192.0.2.88'},body:body===undefined?undefined:JSON.stringify(body)})
    await db.prepare('DELETE FROM oa_limits').run();await db.prepare('DELETE FROM access_rate_limits').run()
    const mailLink=async email=>{
      const row=await db.prepare("SELECT json_extract(message,'$.text') text FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')=? ORDER BY created_at DESC,sequence DESC LIMIT 1").bind(email).first()
      assert.ok(row);return row.text.match(/https?:\/\/[^\s]+/)[0]
    }
    const emailSession=async email=>{
      assert.equal((await call('/auth/request','POST',{email})).status,202)
      const link=new URL(await mailLink(email)),response=await call('/auth/confirm','POST',{token:link.searchParams.get('token')})
      assert.equal(response.status,303);return response.headers.get('set-cookie').split(';')[0]
    }
    let providerEmail=config.FIRST_OWNER_EMAIL
    const context=async cookie=>{
      const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context)
      if(cookie) await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:origin,httpOnly:true,sameSite:'Lax'}])
      await context.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url())
        if(url.origin==='https://accounts.google.com') {
          assert.equal(url.pathname,'/o/oauth2/v2/auth')
          const path=edge.code(url.href,providerEmail)
          return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><title>Google protocol fixture</title><a href="'+origin+path.replaceAll('&','&amp;')+'">Complete Google sign-in</a></html>'})
        }
        assert.equal(url.origin,origin)
        const response=await mf.dispatchFetch(request.url(),{method:request.method(),headers:{...request.headers(),Host:new URL(origin).host},body:request.postDataBuffer()??undefined,redirect:'manual'})
        const location=response.headers.get('location')
        if(response.status===303&&location?.startsWith('https://accounts.google.com/')) {
          // Follow the verified Google redirect at the network edge. Playwright
          // does not route the first cross-origin hop of a fulfilled redirect.
          const path=edge.code(location,providerEmail),headers=Object.fromEntries(response.headers)
          delete headers.location;headers['content-type']='text/html'
          return route.fulfill({status:200,headers,body:'<!doctype html><html lang="en"><title>Google protocol fixture</title><a href="'+origin+path.replaceAll('&','&amp;')+'">Complete Google sign-in</a></html>'})
        }
        await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())})
      })
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page}
    }
    const ownerCookie=await emailSession(config.FIRST_OWNER_EMAIL),owner=await context(ownerCookie)
    await owner.page.goto(origin+'/app/settings/sign-in')
    await owner.page.getByLabel('Google client ID',{exact:true}).fill(edge.clientId)
    await owner.page.getByLabel('Google client secret',{exact:true}).fill(edge.clientSecret)
    const saved=owner.page.waitForResponse(r=>r.url()===origin+'/api/settings/sign-in/google'&&r.request().method()==='PUT')
    await owner.page.getByRole('button',{name:'Save Google client',exact:true}).click()
    const receipt=await saved;assert.equal(receipt.status(),200)
    assert.equal(JSON.stringify(await receipt.json()).includes(edge.clientSecret),false)
    assert.equal(await owner.page.getByLabel('Authorized redirect URI',{exact:true}).inputValue(),origin+'/auth/oidc/google/callback')
    assert.equal(await owner.page.getByLabel('JavaScript origin',{exact:true}).inputValue(),origin)
    await owner.page.getByRole('button',{name:'Test Google sign-in',exact:true}).click()
    await owner.page.getByRole('link',{name:'Complete Google sign-in',exact:true}).click()
    await owner.page.waitForURL(origin+'/app/settings/sign-in')
    await owner.page.getByText('Google test sign-in passed.',{exact:true}).waitFor()
    const enabled=owner.page.waitForResponse(r=>r.url()===origin+'/api/settings/sign-in/google/enabled')
    await owner.page.getByRole('switch',{name:'Offer Google sign-in',exact:true}).focus()
    await owner.page.getByRole('switch',{name:'Offer Google sign-in',exact:true}).press('Space')
    assert.equal((await enabled).status(),200)
    await owner.page.reload();await owner.page.getByRole('switch',{name:'Offer Google sign-in',exact:true}).waitFor()
    assert.equal(await owner.page.getByRole('switch',{name:'Offer Google sign-in',exact:true}).isChecked(),true)
    const axe=require.resolve('axe-core/axe.min.js')
    async function proof(page,name) {
      for(const width of [1440,390]) {
        await page.setViewportSize({width,height:1000})
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
        if(width===1440) {
          await page.addScriptTag({path:axe})
          assert.deepEqual(await page.evaluate(async()=> (await window.axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id)),[])
          assert.equal(await page.evaluate(()=>[...document.querySelectorAll('input,button,label')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=13)),true)
        }
        await page.screenshot({path:resolve(evidence,`google-${name}-${width}.png`),fullPage:true})
      }
      await page.setViewportSize({width:1440,height:1000})
    }
    await proof(owner.page,'settings')
    const memberEmail=googleAddress(21)
    assert.equal((await call('/api/settings/operators/invite','POST',{email:memberEmail,displayName:'Google invited member'},ownerCookie)).status,202)
    const invited=await db.prepare('SELECT id,status FROM oa_operators WHERE email=?').bind(memberEmail).first()
    assert.equal(invited.status,'invited')
    const member=await context();providerEmail=memberEmail
    await member.page.goto(origin+'/signin')
    await member.page.getByRole('button',{name:'Continue with Google',exact:true}).waitFor()
    await member.page.getByLabel('Email',{exact:true}).focus();assert.equal(await member.page.getByLabel('Email',{exact:true}).evaluate(e=>e===document.activeElement),true)
    await proof(member.page,'signin')
    await member.page.getByRole('button',{name:'Continue with Google',exact:true}).click()
    await member.page.getByRole('link',{name:'Complete Google sign-in',exact:true}).click()
    await member.page.waitForURL(origin+'/app')
    const nativeId=await member.page.evaluate(async()=> (await (await fetch('/api/session')).json()).operatorId)
    assert.ok(nativeId)
    assert.equal((await db.prepare('SELECT auth_id FROM vector_auth_operators WHERE operator_id=?').bind(nativeId).first()).auth_id,invited.id)
    assert.equal(await member.page.evaluate(async()=> (await fetch('/auth/signout',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status),204)
    await member.page.goto(origin+'/signin')
    await member.page.getByRole('button',{name:'Continue with Google',exact:true}).waitFor()
    await db.prepare('DELETE FROM oa_limits').run();await db.prepare('DELETE FROM access_rate_limits').run()
    await member.page.getByLabel('Email',{exact:true}).fill(memberEmail)
    const mail=member.page.waitForResponse(r=>r.url()===origin+'/auth/request')
    await member.page.getByRole('button',{name:'Send sign-in link',exact:true}).click();assert.equal((await mail).status(),202)
    await member.page.goto(await mailLink(memberEmail))
    await member.page.getByRole('button',{name:'Confirm',exact:true}).click();await member.page.waitForURL(origin+'/app')
    assert.equal(await member.page.evaluate(async()=> (await (await fetch('/api/session')).json()).operatorId),nativeId)
    assert.equal((await db.prepare('SELECT enabled FROM vector_google_configuration').first()).enabled,1)
    assert.deepEqual(errors,[])
    console.log('PROBE ROLE-010 browser: rendered Owner configure, test and enable; invited signed Google admission and magic link retain the same native ID; Settings and sign-in at 1440 and 390; accessibility and hydration passed.')
  } finally {for(const context of contexts)await context.close();await mf.dispose()}
}
