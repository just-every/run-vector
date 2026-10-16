import assert from 'node:assert/strict';

// Retain a real completed run so its existing Read / resume action can admit
// a list refresh even when Settings already received the initial list from SSR.
export async function completedListAnchor(page, base, team, status, width) {
 const post=async(path,data)=>{
  const response=await page.request.post(base+path,{headers:{Origin:base},data});
  assert.equal(response.status(),200,path);return response.json();
 };
 const input={format:'json',source:'stale-list-anchor-'+width,name:'anchor.json',
  base64:Buffer.from(JSON.stringify([{id:'anchor',title:'Retained list refresh anchor',team:team.name}])).toString('base64'),
  mapping:{sourceId:'id',title:'title',team:'team'},defaults:{status:status.id}};
 const review=await post('/api/data/import/preview',input);assert.equal(review.ready,true);
 const created=await post('/api/data/import/apply',{input:{...input,effectiveAt:review.effectiveAt},reviewedFingerprint:review.fingerprint,operationKey:'stale-list-anchor-'+width,acknowledgeOmissions:true});
 const completed=await post('/api/data/import/runs/'+created.id+'/resume',{});
 assert.equal(completed.state,'completed');return completed;
}
