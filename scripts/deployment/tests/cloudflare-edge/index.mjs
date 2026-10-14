import {importFixture} from './import.mjs';
import { databaseRequest } from './sql.mjs';
import { workerRequest } from './workers.mjs';

// Vector owns this narrow D1/R2/Worker/DO protocol fixture; it never calls a live account.
export function providerFixture() {
  const accountId='a'.repeat(32),token='test-only-provider-token';
  const state={calls:[],writes:[],databases:[],buckets:[],namespaces:[],settings:null,version:null,deployments:[],secrets:[],subdomain:false,schedules:[],objects:new Map(),failSql:null,healthOverride:null};
  const imports=importFixture(accountId);
  const failures=[],prefix=`/client/v4/accounts/${accountId}`;
  const ok=(result,result_info)=>Response.json({success:true,errors:[],result,...(result_info?{result_info}:{})});
  const missing=()=>Response.json({success:false,errors:[{code:100,message:'missing'}]},{status:404});
  async function handle(input,init={}) {
    const url=new URL(input),method=init.method??'GET',path=url.pathname.slice(prefix.length);
    const uploaded=imports.upload(url,init);if(uploaded)return uploaded;
    if(url.hostname.endsWith('.workers.dev')) {
      if(new Headers(init.headers).has('Authorization'))throw Error('Credential sent to health endpoint');
      if(state.healthOverride)return state.healthOverride();
      const vars=Object.fromEntries(state.settings.bindings.filter(item=>item.type==='plain_text').map(item=>[item.name,item.text]));
      return Response.json({ok:true,deployment:{sourceSha:vars.RER_DEPLOY_SOURCE,fingerprint:vars.RER_DEPLOY_FINGERPRINT,versionId:state.version.id}});
    }
    if(url.origin!=='https://api.cloudflare.com'||!url.pathname.startsWith(prefix+'/'))throw Error('Unexpected provider destination');
    const expected=path==='/workers/assets/upload'?'fixture-upload-jwt':token;
    if(new Headers(init.headers).get('Authorization')!==`Bearer ${expected}`)throw Error('Invalid fixture credential');
    state.calls.push({method,path,search:url.search});
    const body=typeof init.body==='string'?JSON.parse(init.body):init.body;
    const write=body=>state.writes.push({method,path,body});
    const context={path,method,body,state,ok,missing,write,imports};
    const database=databaseRequest(context);if(database)return database;
    if(path==='/workers/durable_objects/namespaces'&&method==='GET')return ok(state.namespaces,{page:1,per_page:100,total_count:state.namespaces.length});
    if(path==='/r2/buckets') {
      if(method==='GET')return ok({buckets:state.buckets},{per_page:100});
      const row={name:body.name,jurisdiction:'default',storage_class:'Standard'};state.buckets.push(row);write(body);return ok(row);
    }
    if(path.startsWith('/r2/buckets/')){const row=state.buckets.find(row=>row.name===path.split('/').at(-1));return row?ok(row):missing();}
    const worker=await workerRequest(context);if(worker)return worker;
    throw Error(`Unexpected Vector provider request: ${method} ${path}`);
  }
  return {accountId,token,state,
    async fetch(input,init={}) {
      const method=init.method??'GET',path=new URL(input).pathname.slice(prefix.length);
      const index=failures.findIndex(failure=>failure.method===method&&failure.path.test(path));
      if(index<0)return handle(input,init);
      const [failure]=failures.splice(index,1);
      if(failure.afterApply){await handle(input,init);throw new TypeError('Test lost provider response');}
      state.calls.push({method,path,failed:true});
      if(failure.transport)throw new TypeError('Test connection reset');
      return Response.json({success:false,errors:[{code:10000,message:'Injected failure'}]},{status:failure.status??500});
    },
    fail(method,path,options={}){failures.push({method,path,...options});},
    close(){for(const row of state.databases)row.db.close();}
  };
}
