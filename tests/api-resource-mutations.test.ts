import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiResourceController } from '../src/core/app/api-client.ts';
import { privateReads } from '../src/core/app/read-lifecycle.ts';
function harness(t: {after: (cleanup: () => void) => void}) {
  const calls: {signal: AbortSignal; resolve: (value: number) => void}[] = [];
  const values: number[] = [];
  const controller = createApiResourceController<number>(signal => new Promise(resolve => calls.push({signal,resolve})), state => {if(state.data !== null) values.push(state.data)});
  t.after(() => { controller.dispose(); for (const call of calls) call.resolve(0); });
  return {calls,values,controller};
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('committed updates drain and coalesce without publishing an older snapshot; a later commit is eventually read', {timeout:5000}, async (t) => {
  const h=harness(t), initial=h.controller.refresh();
  const first=h.controller.refreshAfterMutation(), second=h.controller.refreshAfterMutation();
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].signal.aborted,false);
  h.calls[0].resolve(1);await initial;await tick();
  assert.deepEqual(h.values,[]);assert.equal(h.calls.length,2);
  const third=h.controller.refreshAfterMutation();
  assert.equal(h.calls[1].signal.aborted,false);
  h.calls[1].resolve(2);await tick();
  assert.deepEqual(h.values,[]);assert.equal(h.calls.length,3);
  h.calls[2].resolve(3);await Promise.all([first,second,third]);
  assert.equal(h.values.at(-1),3);h.controller.dispose();
});
test('identity disposal aborts an admitted read and prevents a queued mutation refresh', {timeout:5000}, async (t) => {
  const h=harness(t), initial=h.controller.refresh(), mutation=h.controller.refreshAfterMutation();
  h.controller.dispose();assert.equal(h.calls[0].signal.aborted,true);
  h.calls[0].resolve(1);await Promise.all([initial,mutation]);
  assert.equal(h.calls.length,1);assert.deepEqual(h.values,[]);
});
test('committed refresh observes private-read pause and resumes through the existing authority boundary', {timeout:5000}, async (t) => {
  const h=harness(t);privateReads.pause();
  try {await h.controller.refreshAfterMutation();assert.equal(h.calls.length,0);}
  finally {privateReads.resume();}
  assert.equal(h.calls.length,1);h.calls[0].resolve(2);await tick();
  assert.equal(h.values.at(-1),2);h.controller.dispose();
});
