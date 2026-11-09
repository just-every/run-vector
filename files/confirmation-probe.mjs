import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function createProbe(state, secret, base, group) {
  const events=[], aliases=new Map(), output=process.env.CONFIRM_PROBE_FILE;
  const hash=(purpose,subject)=>createHmac('sha256',secret).update(purpose+'\0'+subject).digest('hex');
  const ipKey=hash('rate','confirmation:ip:loopback');
  function read(query,...args) {
    const dir=resolve(state,'v3/d1/miniflare-D1DatabaseObject');
    const files=readdirSync(dir).filter(n=>/^[a-f0-9]{64}\.sqlite$/.test(n));
    if(files.length!==1) throw Error('probe requires one D1');
    const db=new DatabaseSync(resolve(dir,files[0]),{readOnly:true});
    try {return db.prepare(query).all(...args);}finally{db.close();}
  }
  function response(url,method,body,status) {
    const u=new URL(url);
    if(u.origin!==base || u.pathname!=='/auth/confirm' || method!=='POST')return;
    const now=Date.now();
    let token;
    if(body && typeof body==='object')token=body.token;
    else if(typeof body==='string'){
      try {token=JSON.parse(body).token;} catch {token=new URLSearchParams(body).get('token');}
    }
    const tokenKey=typeof token==='string'?hash('rate','confirmation:email:'+token.slice(0,128)):null;
    if(tokenKey&&!aliases.has(tokenKey))aliases.set(tokenKey,aliases.size+1);
    const ip=read('SELECT window,count FROM oa_limits WHERE key=?',ipKey)[0]??null;
    const tokenBucket=tokenKey?read('SELECT window,count FROM oa_limits WHERE key=?',tokenKey)[0]??null:null;
    const row={revision:process.env.CONFIRM_PROBE_REVISION,group,at:now,status,ipBucket:'confirmation:ip:loopback',fixedWindowSeconds:900,ipLimit:30,tokenLimit:5,ip,token:tokenKey?aliases.get(tokenKey):null,tokenBucket};
    events.push(row);
    row.ipRollingMinute=events.filter(e=>e.at>now-60000).length;
    row.tokenRollingMinute=tokenKey?events.filter(e=>e.token===row.token&&e.at>now-60000).length:null;
    row.operatorBuckets=read("SELECT key,count FROM access_rate_limits WHERE key LIKE 'operator:%'").map((r,i)=>({alias:i+1,window:Number(r.key.split(':').at(-1)),count:r.count}));
    appendFileSync(output,JSON.stringify(row)+'\n');
    console.info('[Confirmation probe] '+JSON.stringify({...row,operatorBuckets:undefined}));
  }
  function attach(context) {
    context.on('response',r=>{const q=r.request();response(q.url(),q.method(),q.postData(),r.status());});
  }
  const probe={response,attach};
  globalThis.__confirmationProbe=probe;
  return probe;
}
