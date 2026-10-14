import {createHash,randomUUID} from 'node:crypto';

// Test-only paid edge: preserve uploaded bytes and execute the complete SQL file.
export function importFixture(accountId) {
 const uploads=new Map();
 return {
  upload(url,init) {
   if(url.hostname!==`${accountId}.r2.cloudflarestorage.com`)return;
   const headers=new Headers(init.headers),entry=uploads.get(url.pathname.slice(1));
   if(!entry || init.method!=='PUT' || headers.has('Authorization') || init.redirect!=='error')throw Error('Unsafe import upload');
   const bytes=Buffer.from(init.body),etag=createHash('md5').update(bytes).digest('hex');
   if(etag!==entry.etag || Number(headers.get('Content-Length'))!==bytes.length)throw Error('Import bytes changed');
   entry.sql=bytes.toString('utf8');
   return new Response(null,{headers:{etag:`"${etag}"`}});
  },
  request({body,row,state,ok,write}) {
   if(body.action==='init') {
    const filename=randomUUID();uploads.set(filename,{etag:body.etag});
    return ok({filename,upload_url:`https://${accountId}.r2.cloudflarestorage.com/${filename}?signature=test-only`});
   }
   const entry=uploads.get(body.filename);
   if(body.action!=='ingest' || !entry?.sql || entry.etag!==body.etag)throw Error('Missing import bytes');
   write({sql:entry.sql});
   try {
    row.db.exec('BEGIN');
    if(state.failSql&&entry.sql.includes(state.failSql))throw Error('Injected SQL failure');
    row.db.exec(entry.sql);row.db.exec('COMMIT');
    return ok({success:true,type:'import',status:'complete',messages:[],result:{num_queries:1,final_bookmark:'test-bookmark'}});
   } catch {
    if(row.db.isTransaction)row.db.exec('ROLLBACK');
    return ok({success:true,type:'import',status:'error',errors:['SQL refused'],messages:[]});
   }
  }
 };
}
