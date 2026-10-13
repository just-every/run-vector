import assert from 'node:assert/strict';

/** Exercise the live selector against an intentionally stale authoritative review. */
export async function verifyQualifiedStatusControls({panel,native,fixture,reference,preview,proof}) {
 const source='To Do',control=panel.getByLabel('Confirm statuses '+source,{exact:true});
 const target=result=>result.jiraReview.statuses.find(row=>row.source===source)?.target;
 const aliases=()=>proof.previews.at(-1).statusMappings;
 const otherAlias=native.otherTeam.name+'/'+source,qualifiedAlias=native.team.name+'/'+source;
 const preserved=()=>assert.equal(aliases()[otherAlias],native.otherStatus.id,'Other team qualified alias stays unchanged');
 await reference('status',source,native.statuses.completed.id);
 await reference('status',native.otherTeam.name+'/'+source,native.otherStatus.id);
 await reference('status',native.team.name+'/'+source,native.statuses.unstarted.id);
 let result=await preview(fixture);
 assert.equal(target(result),native.statuses.unstarted.id);
 assert.equal(await control.inputValue(),native.statuses.unstarted.id);
 assert.equal(aliases()[source],native.statuses.completed.id);preserved();
 const transitions=[];
 // Deliberately leave the review object at A while changing its live mapping B→C.
 for(const category of ['started','completed']) {
  await control.selectOption(native.statuses[category].id);
  assert.equal(await control.inputValue(),native.statuses[category].id);
  assert.equal(await panel.getByRole('button',{name:'Apply reviewed run',exact:true}).isDisabled(),true);
  transitions.push({category,live:await control.inputValue(),staleReview:target(result)});
 }
 result=await preview(fixture);
 assert.equal(target(result),native.statuses.completed.id);
 assert.equal(await control.inputValue(),native.statuses.completed.id);
 assert.equal(aliases()[qualifiedAlias],native.statuses.completed.id);preserved();
 await control.selectOption('');
 assert.equal(await control.inputValue(),'');
 result=await preview(fixture);
 assert.equal(aliases()[qualifiedAlias],undefined);assert.equal(aliases()[source],undefined);preserved();
 assert.equal(target(result),null,'Unconfirmed clears the qualified and competing bare aliases');
 assert.equal(result.ready,false);
 assert.equal(await control.inputValue(),'');
 await control.selectOption(native.statuses.unstarted.id);
 assert.equal(await control.inputValue(),native.statuses.unstarted.id);
 result=await preview(fixture);
 assert.equal(target(result),native.statuses.unstarted.id);
 assert.equal(result.ready,true);
 assert.equal(await control.inputValue(),native.statuses.unstarted.id);
 // Clearing removed the qualified alias; the public lookup now chooses the
 // bare source key when the operator confirms it again.
 assert.equal(aliases()[qualifiedAlias],undefined);
 assert.equal(aliases()[source],native.statuses.unstarted.id);preserved();
 proof.statusControls={source,qualifiedTeam:native.team.name,otherTeam:native.otherTeam.name,transitions,unconfirmedTarget:null,finalTarget:target(result),finalAliases:aliases()};
}
