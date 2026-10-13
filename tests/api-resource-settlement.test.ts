import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createApiResourceController} from '../src/core/app/api-client.ts';

test('a commit between the drain loop finishing and its finalizer still starts a fresh native read', async t => {
  let reads=0,commits=0;const published:number[]=[];
  const controller=createApiResourceController(async()=>++reads,state=>{
    if(state.data===null)return;
    published.push(state.data);
    if(state.data===1 && commits===0) {
      commits++;
      // An independently settled mutation can reach its completion callback in
      // this microtask turn, after the read loop settles and before its finally.
      queueMicrotask(()=>queueMicrotask(()=>void controller.refreshAfterMutation()));
    }
  });
  t.after(()=>controller.dispose());
  await controller.refreshAfterMutation();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(commits,1);
  assert.equal(reads,2,'the newest committed mutation must be read, even at queue settlement');
  assert.equal(published.at(-1),2);
});


test('reentrant publication commits finish before every admitted mutation promise', async t => {
 let reads=0, committed=false; const calls: Promise<void>[]=[];
 const controller=createApiResourceController(async()=>++reads,state=>{
  if(state.data===1 && !committed) { committed=true; calls.push(controller.refreshAfterMutation()); }
 });
 t.after(()=>controller.dispose());
 calls.push(controller.refreshAfterMutation());
 await Promise.all(calls);
 assert.equal(reads,2);
});

test('disposal during settlement prevents queued work and resolves its promises', async t => {
 let reads=0; let late: Promise<void> | undefined;
 const controller=createApiResourceController(async()=>++reads,state=>{
  if(state.data===1)queueMicrotask(()=>queueMicrotask(()=>{
   late=controller.refreshAfterMutation(); controller.dispose();
  }));
 });
 t.after(()=>controller.dispose());
 await controller.refreshAfterMutation();
 await new Promise(resolve=>setImmediate(resolve));
 await late;
 assert.equal(reads,1);
});
