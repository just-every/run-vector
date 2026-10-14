import { randomUUID,createHash } from 'node:crypto';

export async function workerRequest({path,method,body,state,ok,missing,write}) {
  if(path==='/workers/subdomain')return ok({subdomain:'fixture-account'});
  if(path==='/workers/assets/upload'){write();return ok({jwt:'fixture-complete-jwt'});}
  const match=/^\/workers\/scripts\/([^/]+)(.*)$/.exec(path);if(!match)return;
  const suffix=match[2];
  if(suffix==='/assets-upload-session'){write(body);return ok({jwt:'fixture-upload-jwt',buckets:[[...new Set(Object.values(body.manifest).map(item=>item.hash))]]});}
  if(suffix==='/settings')return state.settings?ok(state.settings):missing();
  if(suffix==='/deployments')return ok({deployments:state.deployments});
  if(suffix.startsWith('/versions/'))return ok(state.version);
  if(suffix==='/secrets')return ok(state.secrets.map(({name})=>({name,type:'secret_text'})));
  if(suffix==='/schedules') {
    if(method!=='GET'){state.schedules=body;write(body);}
    return ok({schedules:state.schedules});
  }
  if(suffix==='/subdomain') {
    if(method!=='GET'){state.subdomain=body.enabled;write(body);}
    return ok({enabled:state.subdomain});
  }
  if(suffix===''&&method==='PUT') {
    const metadata=JSON.parse(await body.get('metadata').text());
    const migration=metadata.migrations;
    if(migration) {
      if(migration.old_tag!==(state.settings?.migration_tag??''))throw Error('DO migration predecessor mismatch');
      for(const name of migration.new_sqlite_classes??[]) {
        if(state.namespaces.some(row=>row.script===match[1]&&row.class===name))throw Error('DO class already exists');
        state.namespaces.push({id:randomUUID().replaceAll('-',''),script:match[1],class:name,use_sqlite:true});
      }
    }
    for(const item of metadata.bindings.filter(item=>item.type==='secret_text'))state.secrets.push({name:item.name,value:item.text});
    const bindings=metadata.bindings.map(item=>['inherit','secret_text'].includes(item.type)?{name:item.name,type:'secret_text'}:item);
    const id=randomUUID();
    state.settings={...metadata,bindings,migration_tag:migration?.new_tag??state.settings?.migration_tag};
    // The provider reports the handlers it detected; Vector's Worker exports fetch and scheduled.
    state.version={id,resources:{bindings,script:{etag:createHash('sha256').update(await body.get(metadata.main_module).text()).digest('hex'),handlers:['fetch','scheduled']}}};
    state.deployments=[{id:randomUUID(),versions:[{version_id:id,percentage:100}]}];
    write({bindings:bindings.map(({name,type})=>({name,type}))});return ok({id:match[1],deployment_id:id});
  }
}
