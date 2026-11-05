import assert from 'node:assert/strict';

// This exercises native HTTP persistence in the emitted Worker. The notes
// interface and its independent visual gate remain separate, unproved work.
export async function releaseNotesHttpJourney({call,team,done,owner}){
 const projects=[];
 for(const name of ['synthetic-vector-9241','synthetic-vector-9242']){
  const state=await call('/settings/projects','POST',{name,leadOperatorId:owner});
  projects.push(state.projects.find(project=>project.name===name));
 }
 const issues=[];
 for(let index=0;index<6;index++)issues.push(await call('/issues','POST',{
  teamId:team.id,statusId:done.id,projectId:projects[index<3?0:1].id,title:'synthetic-vector-9243-'+index,
 },201));
 const open=await call('/issues','POST',{teamId:team.id,projectId:projects[0].id,title:'synthetic-vector-9244'},201);
 await call('/issues/'+issues[0].identifier,'PATCH',{expectedVersion:issues[0].version,title:'synthetic-vector-9245 current title'});
 let release=await call('/releases','POST',{name:'synthetic-vector-9246',description:'synthetic-vector-9247 independent description'},201);
 assert.equal(release.ownerOperatorId,owner);
 release=await call('/releases/'+release.id+'/scope','PUT',{
  expectedVersion:release.version,projectIds:projects.map(project=>project.id),issueIdentifiers:issues.map(issue=>issue.identifier),
 });
 const door='/releases/'+release.id+'/notes';
 const generated=await call(door,'POST',{expectedReleaseVersion:release.version},201);
 assert.equal(generated.draft.ownerOperatorId,owner);assert.equal(generated.draft.authorOperatorId,owner);
 assert.deepEqual(generated.draft.sources.map(source=>source.id).sort(),issues.map(issue=>issue.id).sort());
 assert.deepEqual(generated.draft.sources.map(source=>source.projectId),[projects[0].id,projects[0].id,projects[0].id,projects[1].id,projects[1].id,projects[1].id]);
 assert.equal(generated.draft.sources.find(source=>source.id===issues[0].id).title,'synthetic-vector-9245 current title');
 assert.ok(!generated.draft.sources.some(source=>source.id===open.id));
 const line=(index,title)=>'- ['+issues[index].identifier+'](/app/issues/'+issues[index].identifier+') — '+title;
 const expected='## [synthetic-vector-9241](/app/projects/'+projects[0].id+')\n\n'+[
  line(0,'synthetic-vector-9245 current title'),line(1,'synthetic-vector-9243-1'),line(2,'synthetic-vector-9243-2'),
 ].join('\n')+'\n\n## [synthetic-vector-9242](/app/projects/'+projects[1].id+')\n\n'+[
  line(3,'synthetic-vector-9243-3'),line(4,'synthetic-vector-9243-4'),line(5,'synthetic-vector-9243-5'),
 ].join('\n')+'\n';
 assert.equal(generated.draft.body,expected);
 const edited=expected.replace('synthetic-vector-9243-1','synthetic-vector-9248 edited line')+'\n';
 const saved=await call(door,'PATCH',{expectedReleaseVersion:release.version,expectedVersion:1,body:edited});
 assert.equal(saved.draft.body,edited);assert.equal(saved.draft.version,2);
 assert.deepEqual((await call(door)).draft,saved.draft);
 await call(door,'POST',{expectedReleaseVersion:release.version},409);
 await call(door,'PATCH',{expectedReleaseVersion:release.version,expectedVersion:1,body:'synthetic-vector-9249 stale'},409);
 release=await call('/releases/'+release.id+'/scope','PUT',{expectedVersion:release.version,projectIds:[],issueIdentifiers:issues.map(issue=>issue.identifier)});
 const retained=await call(door);
 assert.equal(retained.releaseChanged,true);assert.equal(retained.draft.body,edited);assert.deepEqual(retained.draft.sources,saved.draft.sources);
 assert.equal(release.description,'synthetic-vector-9247 independent description');assert.equal(release.status,'planned');
 for(const issue of issues){
  const detail=await call('/issues/'+issue.identifier);
  assert.equal(detail.activity.filter(event=>event.kind==='release.published'&&event.nextValue.releaseId===release.id).length,0);
 }
 console.log('PROBE RELEASE-003 native HTTP: six exact completed sources, current titles and project groups; edited draft retained after fresh read and scope change; stale saves refused; no release publication');
}
