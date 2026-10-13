import assert from 'node:assert/strict';
export async function finishFirstRun(page,origin) {
 const response=await page.request.get(origin+'/api/setup');
 assert.equal(response.status(),200);
 const state=await response.json();
 if(state.owner&&!state.completed) {
  const completed=await page.request.post(origin+'/api/setup/complete',{headers:{Origin:origin},data:{confirmed:true}});
  assert.equal(completed.status(),200);
  assert.equal((await completed.json()).completed,true);
 }
}
