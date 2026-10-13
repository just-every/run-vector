import {expect} from 'vitest';
import {destination,targetCall,stageArchive,type ArchiveRecords} from './http-archive-fixture';
/** Pause a real ordinary write after request admission but before its first D1
 * transaction. Import admission must atomically win or refuse; no JS-only fence. */
export async function reserveWithRacingWriter(records:ArchiveRecords,cookie:string) {
 const db=destination.ARCHIVE_TARGET_DB,team=await db.prepare('SELECT id FROM teams LIMIT 1').first<string>('id');
 let reached!:()=>void,release!:()=>void,paused=false;
 const entered=new Promise<void>(resolve=>{reached=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 const delayed=new Proxy(db,{get(target,key){
  if(key==='batch')return async(statements:D1PreparedStatement[])=>{
   if(!paused){paused=true;reached();await gate;}
   return target.batch(statements);
  };
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
 const writing=targetCall('/api/issues','POST',{title:'Raced destination write',teamId:team},cookie,{DB:delayed});
 try {
  await Promise.race([entered,writing.then(result=>{throw Error('Writer returned before D1 admission: '+result.status);})]);
  const job=await stageArchive(records,cookie);release();
  expect((await writing).status).toBe(409);
  for(const table of ['team_issue_sequences','issue_prefix_sequences'])expect((await db.prepare('SELECT count(*) AS n FROM '+table).first())?.n).toBe(0);
  expect((await db.prepare('SELECT count(*) AS n FROM issues').first())?.n).toBe(0);
  return job;
 } finally {release();await Promise.allSettled([writing]);}
}
