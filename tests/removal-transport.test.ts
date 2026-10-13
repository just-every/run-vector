import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {heldRequest} from './e2e/removal-runtime-support.mjs';

test('held native requests do not reuse a socket expired during a synchronous D1 query', {timeout:5000},async()=>{
 const server=fork(new URL('./fixtures/held-request-server.mjs',import.meta.url),{stdio:['ignore','ignore','ignore','ipc']});
 const events: {event:string;method?:string;port?:number}[]=[];const waiting=new Set<()=>void>();
 server.on('message',(event: {event:string;method?:string;port?:number})=>{events.push(event);for(const done of waiting)done();});
 async function eventAt(index:number){
  if(events[index])return events[index];
  await new Promise<void>((resolve,reject)=>{
   const done=()=>{if(events[index]){clearTimeout(timer);waiting.delete(done);resolve();}};
   const timer=setTimeout(()=>{waiting.delete(done);reject(Error('Held prefix never reached the server'));},1000);waiting.add(done);
  });
  return events[index];
 }
 const pending:ReturnType<typeof heldRequest>[]=[];
 try {
  const ready=await eventAt(0);assert.equal(ready.event,'ready');const base='http://127.0.0.1:'+ready.port;
  const first=heldRequest('synthetic=fixture','/held','POST','{"body":',base);pending.push(first);
  assert.equal((await eventAt(1)).method,'POST');first.release('"one"}');assert.equal((await first.response).status,200);
  // Native D1 CLI snapshots synchronously block this client, while the actual
  // remote process can retire its idle keep-alive connection independently.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);
  const second=heldRequest('synthetic=fixture','/held','PATCH','{"title":',base);pending.push(second);
  assert.equal((await eventAt(2)).method,'PATCH');second.release('"two"}');assert.equal((await second.response).status,200);
 } finally {
  for(const request of pending)request.abort();
  if(server.connected)server.send('stop');
  await new Promise<void>(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',()=>resolve());});
 }
});
