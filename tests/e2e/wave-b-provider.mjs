import {createServer} from 'node:http';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';

/** Test-only RER network peer. It cannot create a Vector owner or session. */
export async function waveBProvider(appOrigin,email) {
  const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const publicKey=keys.publicKey.export({format:'jwk'});
  let origin;
  const token=()=>{
    const now=Math.floor(Date.now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
    const data=encode({alg:'ES256',typ:'rer-owner-claim+jwt',kid:'fixture'})+'.'+encode({v:1,iss:origin,aud:appOrigin,installationId:'vector-browser',email,jti:randomUUID(),iat:now,exp:now+300});
    return data+'.'+sign('sha256',Buffer.from(data),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  };
  const server=createServer((request,response)=>{
    response.setHeader('Content-Type','text/html; charset=utf-8');
    response.setHeader('Cache-Control','no-store');
    const path=new URL(request.url,'http://localhost').pathname;
    if(path==='/install') {
      response.end(`<!doctype html><html lang="en"><title>Local claim peer</title><body><main><h1>Local claim protocol fixture</h1><button>Open claim</button></main><script>
        const app=${JSON.stringify(appOrigin)},claim=${JSON.stringify(token())};let popup;
        document.querySelector('button').onclick=()=>{popup=window.open(app+'/auth/owner-claim','vector-claim');};
        addEventListener('message',event=>{if(event.source===popup&&event.origin===app&&event.data?.type==='rer-owner-claim-ready')popup.postMessage({type:'rer-owner-claim',token:claim},app);});
      </script></body></html>`);return;
    }
    if(path==='/editor') {
      response.setHeader('Content-Security-Policy',`frame-ancestors ${appOrigin}; object-src 'none'; base-uri 'none'`);
      response.end(`<!doctype html><html lang="en"><title>Local editor peer</title><style>body{margin:0;font:16px sans-serif;color:#161616}main{box-sizing:border-box;position:fixed;left:12px;top:12px;width:min(340px,calc(100vw - 24px));height:220px;padding:16px;background:white;border:1px solid #888}h1{font-size:20px}label,textarea{display:block}textarea{box-sizing:border-box;width:100%;height:90px}</style><body><main><h1>Local editor protocol fixture</h1><label>Draft<textarea aria-label="Draft"></textarea></label></main><script>
        const app=${JSON.stringify(appOrigin)};let session;
        const wire=(type,extra={})=>parent.postMessage({protocol:'rer-editor',version:1,installationId:'vector-browser',type,...(session?{sessionId:session}:{}),...extra},app);
        const surface=()=>{const {x,y,width,height}=document.querySelector('main').getBoundingClientRect();wire('interactive-regions',{viewport:{width:innerWidth,height:innerHeight},regions:[{x,y,width,height}]});};
        addEventListener('message',event=>{if(event.source!==parent||event.origin!==app)return;const data=event.data;
          if(data.protocol!=='rer-editor'||data.version!==1||data.installationId!=='vector-browser')return;
          if(data.type==='protocol-offer'){session=data.sessionId;wire('protocol-accept');}
          if(data.type==='protocol-connected'){document.body.dataset.connected='true';surface();}
          if(data.type==='editor-visibility'&&data.open)surface();
        });addEventListener('resize',surface);wire('ready');
      </script></body></html>`);return;
    }
    if(path==='/embed'||path==='/embed-lobby'){
      const target=path==='/embed'?'/app':'/';
      response.end(`<!doctype html><html lang="en"><title>Framing probe</title><body><iframe title="Vector framing probe" src="${appOrigin}${target}"></iframe></body></html>`);return;
    }
    response.statusCode=404;response.end('Not found');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  return {origin,publicKeys:JSON.stringify({fixture:publicKey}),token,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}
