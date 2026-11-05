import { createOidcProviders, createOidcHandler } from '../../../../vendor/base/operator-auth/identity/oidc/index.mjs'
import { AuthError } from '../../../../vendor/base/operator-auth/index.mjs'
import { authConfig } from './base.server'
import { googleConfiguration, googleSecrets, googleOwner } from './google-settings'
import { admitGoogle } from './google-admission'
import type { WorkerBindings } from '../../app/bindings'

const endpoints = new Map([
  ['https://accounts.google.com/.well-known/openid-configuration','discovery'],
  ['https://oauth2.googleapis.com/token','token'],
  ['https://www.googleapis.com/oauth2/v3/certs','keys'],
])
/** Base fixes Google issuer and signing policy. Native composition additionally
 * fixes the exact Google endpoints and refuses redirect-based substitutions. */
export async function googleProviders(env:WorkerBindings,request?:Request) {
  const row=await googleConfiguration(env.DB)
  if(!row) return null
  const test=!!request && (new URL(request.url).pathname.endsWith('/test') || !row.enabled)
  if(test) {
    if(row.enabled) throw new AuthError('google_already_enabled',409)
    const {operator}=await googleOwner(env,request!)
    if(operator.fence.sessionId!==row.test_session_id) throw new AuthError('google_test_owner_required',403)
  }
  const secrets=await googleSecrets(env,row),config=authConfig(env)
  const providers=createOidcProviders({db:env.DB,clientIp:r=>config.local?'loopback':r.headers.get('CF-Connecting-IP')??'',
    enabled:async()=>{const current=await googleConfiguration(env.DB);return current?.generation===row.generation && (test || current.enabled===1)},
    policyVersion:async()=>(await googleConfiguration(env.DB))?.generation??-1,
    config:{origin:env.APP_ORIGIN,local:config.local,transactionSecret:secrets.transactionSecret,signInPath:'/signin',
      providers:[{id:'google',preset:'google',clientId:row.client_id,clientSecret:secrets.clientSecret,tokenAuthMethod:'client_secret_post'}]},
    admission:{admit:async(r,p,options)=>admitGoogle(env,r,p,row,test,options?.returnTo??'/app')},
    fetch:async(url,init)=>{
      const href=String(url),kind=endpoints.get(href)
      if(!kind) throw new Error('google_endpoint_refused')
      const response=await fetch(url,init)
      if(kind==='discovery' && response.ok) {
        const data=await response.clone().json() as Record<string,unknown>
        if(data.issuer!=='https://accounts.google.com' || data.authorization_endpoint!=='https://accounts.google.com/o/oauth2/v2/auth'
          || data.token_endpoint!=='https://oauth2.googleapis.com/token' || data.jwks_uri!=='https://www.googleapis.com/oauth2/v3/certs')
          throw new Error('google_endpoint_refused')
      }
      return response
    },
  })
  return providers
}
export async function googleResponse(env:WorkerBindings,request:Request) {
  const providers=await googleProviders(env,request)
  if(!providers) throw new AuthError('google_not_configured',403)
  if(new URL(request.url).pathname==='/auth/oidc/google/test') {
    const url=new URL(request.url);url.pathname='/auth/oidc/google/start'
    return providers.begin(new Request(url,request),'google',{returnTo:'/app/settings/sign-in'})
  }
  return createOidcHandler(providers)(request)
}
