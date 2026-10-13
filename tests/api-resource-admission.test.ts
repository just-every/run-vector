import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiResourceController} from '../src/core/app/api-client.ts';

test('mutation refresh drains reads admitted after it starts waiting, then reads the newest state', {timeout:5000}, async t=>{
 const calls:{signal:AbortSignal;resolve:(value:number)=>void}[]=[];
 const values:number[]=[];
 const controller=createApiResourceController<number>(signal=>new Promise(resolve=>calls.push({signal,resolve})),state=>{if(state.data!==null)values.push(state.data)});
 t.after(()=>{controller.dispose();for(const call of calls)call.resolve(0)});
 const first=controller.refresh(),mutation=controller.refreshAfterMutation();
 const second=controller.refresh();
 assert.equal(calls[0].signal.aborted,true,'explicit reload keeps its own supersession behavior');
 assert.equal(calls.length,2);
 calls[0].resolve(1);await first;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls[1].signal.aborted,false,'the mutation drain must not cancel a newly admitted explicit read');
 assert.equal(calls.length,2,'the new explicit read must drain before the committed refresh');
 // Another explicit reload still owns supersession; the mutation queue must
 // notice and drain this replacement too, without becoming a promise cycle.
 const third=controller.refresh();assert.equal(calls[1].signal.aborted,true);
 calls[1].resolve(2);await second;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls[2].signal.aborted,false);assert.equal(calls.length,3);
 calls[2].resolve(4);await third;await new Promise(resolve=>setImmediate(resolve));
 // A current admitted read may itself prove the newest state. Also permit a
 // queued follow-up; the contract does not prescribe the drain iteration count.
 for(const call of calls.slice(3))call.resolve(4);
 await mutation;
 assert.equal(values.at(-1),4,'the newest committed state is eventually published');
});
