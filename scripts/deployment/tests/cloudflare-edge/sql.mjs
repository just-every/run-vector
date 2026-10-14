import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

// Only the paid provider boundary is simulated. Migrations execute in SQLite.
export function databaseRequest({path,method,body,state,ok,missing,write,imports}) {
  if(path==='/d1/database') {
    if(method==='GET') return ok(state.databases.map(({db,...row})=>row),{page:1,total_pages:1,total_count:state.databases.length});
    const row={uuid:randomUUID(),name:body.name,db:new DatabaseSync(':memory:')};
    state.databases.push(row);write(body);return ok({uuid:row.uuid,name:row.name});
  }
  const match=/^\/d1\/database\/([^/]+)(\/query|\/import)?$/.exec(path);
  if(!match)return;
  const row=state.databases.find(row=>row.uuid===match[1]);if(!row)return missing();
  if(!match[2])return ok({uuid:row.uuid,name:row.name});
  if(match[2]==='/import')return imports.request({body,row,state,ok,write});
  if(/CREATE\s+(?:(?:TEMP|TEMPORARY)\s+)?TRIGGER/i.test(body.sql))throw Error('Trigger bodies require file import');
  if(/^SELECT /i.test(body.sql))return ok([{success:true,results:row.db.prepare(body.sql).all()}]);
  write(body);
  try {
    row.db.exec('BEGIN');
    if(state.failSql&&body.sql.includes(state.failSql))throw Error('Injected provider SQL failure');
    row.db.exec(body.sql);row.db.exec('COMMIT');return ok([{success:true,results:[]}]);
  } catch { row.db.exec('ROLLBACK');return Response.json({success:false,errors:[{code:1,message:'SQL refused'}]}); }
}
