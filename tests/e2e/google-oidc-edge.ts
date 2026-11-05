import assert from 'node:assert/strict'
const text=new TextEncoder()
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
const encode=(v:unknown)=>b64(text.encode(JSON.stringify(v)))
export const googleAddress=(n:number)=>['synthetic-vector-'+n,'example.test'].join('@')
/** Fake only the network edge. The mounted application performs discovery,
 * the code exchange, signed JWT verification and native account admission. */
export async function googleEdge() {
  const key=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',hash:'SHA-256',modulusLength:2048,publicExponent:new Uint8Array([1,0,1])},true,['sign','verify'])
  const jwk={...await crypto.subtle.exportKey('jwk',key.publicKey),kid:'synthetic-vector-1',alg:'RS256',use:'sig'}
  const clientId='synthetic-vector-'+crypto.randomUUID(),clientSecret='synthetic-vector-'+crypto.randomUUID()
  const transactions=new Map<string,{url:URL;claims:Record<string,unknown>}>(),calls:string[]=[]
  let edgeHook:(()=>Promise<void>)|undefined
  return {clientId,clientSecret,calls,setHook:(hook?:()=>Promise<void>)=>{edgeHook=hook},
    code(location:string,email:string,claims:Record<string,unknown>={}) {
      const url=new URL(location),code='synthetic-vector-'+crypto.randomUUID()
      assert.equal(url.origin+url.pathname,'https://accounts.google.com/o/oauth2/v2/auth')
      assert.equal(url.searchParams.get('client_id'),clientId)
      assert.equal(url.searchParams.get('code_challenge_method'),'S256')
      transactions.set(code,{url,claims:{email,email_verified:true,hd:email.split('@')[1],...claims}})
      return '/auth/oidc/google/callback?'+new URLSearchParams({code,state:url.searchParams.get('state')!})
    },
    async fetch(input:RequestInfo|URL,init?:RequestInit) {
      const url=String(input);calls.push(url)
      assert.equal(init?.redirect,'manual')
      if(url==='https://accounts.google.com/.well-known/openid-configuration') return Response.json({issuer:'https://accounts.google.com',authorization_endpoint:'https://accounts.google.com/o/oauth2/v2/auth',token_endpoint:'https://oauth2.googleapis.com/token',jwks_uri:'https://www.googleapis.com/oauth2/v3/certs',response_types_supported:['code'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_post']})
      if(url==='https://www.googleapis.com/oauth2/v3/certs') return Response.json({keys:[jwk]})
      assert.equal(url,'https://oauth2.googleapis.com/token')
      const form=new URLSearchParams(String(init?.body)),transaction=transactions.get(form.get('code')!)!
      assert.ok(transaction)
      transactions.delete(form.get('code')!)
      assert.equal(form.get('client_id'),clientId);assert.equal(form.get('client_secret'),clientSecret)
      assert.equal(form.get('redirect_uri'),transaction.url.searchParams.get('redirect_uri'))
      assert.equal(b64(new Uint8Array(await crypto.subtle.digest('SHA-256',text.encode(form.get('code_verifier')!)))),transaction.url.searchParams.get('code_challenge'))
      const now=Math.floor(Date.now()/1000)
      const data=encode({alg:'RS256',kid:jwk.kid,typ:'JWT'})+'.'+encode({iss:'https://accounts.google.com',sub:transaction.claims.email,aud:clientId,iat:now,exp:now+300,nonce:transaction.url.searchParams.get('nonce'),...transaction.claims})
      const signature=b64(new Uint8Array(await crypto.subtle.sign({name:'RSASSA-PKCS1-v1_5'},key.privateKey,text.encode(data))))
      await edgeHook?.()
      return Response.json({id_token:data+'.'+signature})
    },
  }
}
