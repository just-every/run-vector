import {runInDurableObject} from 'cloudflare:test';
import {destination} from './http-archive-fixture';
import type {WorkerBindings} from '../../src/core/app/bindings';

/** Fails the coordinator's next D1 execution of matching SQL once: either a
 * transient error, or a parked request the test then cuts off with a reset.
 * The `committed` modes run the statement first, so its effect is durable and
 * only the reply is lost. */
export async function interruptAt(sql:RegExp,mode:'error'|'reset',committed=false) {
 // A reset breaks the stub that observed it; each interruption takes a fresh one.
 const stub=destination.ARCHIVE_TARGET_COORDINATOR.get(destination.ARCHIVE_TARGET_COORDINATOR.idFromName('installation'));
 let reached!:()=>void;const entered=new Promise<void>(resolve=>{reached=resolve;});
 await runInDurableObject(stub,async instance=>{
  const object=instance as unknown as {env:WorkerBindings},old=object.env;let armed=true;const tagged=new WeakSet<object>();
  const fault=async()=>{if(!armed)return;armed=false;object.env=old;if(mode==='reset'){reached();await new Promise(()=>{});}throw Error('Synthetic transient D1 failure');};
  const tag=(statement:D1PreparedStatement):D1PreparedStatement=>{
   const target=statement as unknown as Record<string,(...args:unknown[])=>unknown>;tagged.add(statement);
   const bind=target.bind.bind(statement);target.bind=(...args)=>tag(bind(...args) as D1PreparedStatement);
   for(const key of ['first','all','run','raw']){const call=target[key].bind(statement);target[key]=async(...args)=>{if(!committed)await fault();const result=await call(...args);await fault();return result;};}
   return statement;
  };
  object.env={...old,DB:new Proxy(old.DB,{get(db,key){
   if(key==='prepare')return(text:string)=>{const statement=db.prepare(text);return sql.test(text)?tag(statement):statement;};
   if(key==='batch')return async(statements:D1PreparedStatement[])=>{const hit=statements.some(s=>tagged.has(s));if(hit && !committed)await fault();const result=await db.batch(statements);if(hit)await fault();return result;};
   const value=Reflect.get(db,key,db);return typeof value==='function'?value.bind(db):value;
  }})};
 });
 return {reset:async()=>{
  await runInDurableObject(stub,async()=>{await entered;});
  await runInDurableObject(stub,async(_instance,state)=>{state.abort('Synthetic coordinator reset');}).catch(()=>{});
 }};
}
