import {Buffer} from 'node:buffer';
import {freshTarget,targetCall,destination} from './http-archive-fixture';
import {env} from 'cloudflare:workers';
import {expect,it,vi} from 'vitest';
import {roleWorkspace,resetLimits,snapshot,type Person} from './role-fixture';
import {request} from './base-auth-fixture';

it('native release notes retain six exact completed sources and human revisions while current ownership and source visibility fence every draft operation',async()=>{
 const w=await roleWorkspace(),owner=w.people.owner;
 const json=async(response:Response,status=200)=>{
  expect(response.status,await response.clone().text()).toBe(status);
  return response.json() as Promise<any>;
 };
 const team=w.initial.teams[0],done=team.statuses.find(s=>s.category==='completed')!,canceled=team.statuses.find(s=>s.category==='canceled')!;
 const project=async(name:string)=>(await w.mutate('/settings/projects','POST',{name,leadOperatorId:w.owner})).projects.find(p=>p.name===name)!;
 const alpha=await project('synthetic-vector-9200'),beta=await project('synthetic-vector-9201');
 const titles=['synthetic-vector-9202','synthetic-vector-9203','synthetic-vector-9204','synthetic-vector-9205','synthetic-vector-9206','synthetic-vector-9207'];
 const issues=[];
 for(let i=0;i<6;i++)issues.push(await w.create({title:titles[i],statusId:done.id,projectId:i<2?alpha.id:i<4?beta.id:null}));
 const open=await w.create({title:'synthetic-vector-9208',projectId:alpha.id});
 const canceledIssue=await w.create({title:'synthetic-vector-9209',statusId:canceled.id,projectId:beta.id});
 const outside=await w.create({title:'synthetic-vector-9210',statusId:done.id});
 const changedTitle='synthetic-vector-9211 current title';
 await json(await owner.call('/issues/'+issues[0].identifier,'PATCH',{expectedVersion:issues[0].version,title:changedTitle}));
 let release=await json(await owner.call('/releases','POST',{name:'synthetic-vector-9212',description:'synthetic-vector-9213 separate description'}),201);
 expect(release.ownerOperatorId).toBe(w.owner);
 release=await json(await owner.call('/releases/'+release.id+'/scope','PUT',{
  expectedVersion:release.version,projectIds:[beta.id,alpha.id],issueIdentifiers:[...issues.map(i=>i.identifier),open.identifier,canceledIssue.identifier],
 }));
 const door='/releases/'+release.id+'/notes';
 expect(await json(await owner.call(door))).toEqual({draft:null,canEdit:true,releaseChanged:false});
 const deliveryTables=['issue_activity','integration_deliveries','vector_webhook_events','notification_channel_receipts','notification_candidates'];
 const deliveryBefore=await snapshot(deliveryTables);
 const edge=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{throw Error('Draft operations must not contact a provider.');});
 let draft:any;
 try{
  draft=(await json(await owner.call(door,'POST',{expectedReleaseVersion:release.version}),201)).draft;
  const expectedIds=issues.map(i=>i.id).sort();
  expect(draft.sources.map((i:any)=>i.id).sort()).toEqual(expectedIds);
  expect(draft.sources.map((i:any)=>i.identifier).sort()).toEqual(issues.map(i=>i.identifier).sort());
  expect(draft.sources).toHaveLength(6);
  expect(draft.sources.find((i:any)=>i.id===issues[0].id)).toMatchObject({title:changedTitle,projectId:alpha.id,projectName:alpha.name});
  expect(draft.sources.map((i:any)=>i.projectId)).toEqual([null,null,alpha.id,alpha.id,beta.id,beta.id]);
  expect(draft.ownerOperatorId).toBe(w.owner);expect(draft.authorOperatorId).toBe(w.owner);
  expect(draft.body).toBe('## No project\n\n'+
   '- ['+issues[4].identifier+'](/app/issues/'+issues[4].identifier+') — synthetic-vector-9206\n'+
   '- ['+issues[5].identifier+'](/app/issues/'+issues[5].identifier+') — synthetic-vector-9207\n\n'+
   '## [synthetic-vector-9200](/app/projects/'+alpha.id+')\n\n'+
   '- ['+issues[0].identifier+'](/app/issues/'+issues[0].identifier+') — synthetic-vector-9211 current title\n'+
   '- ['+issues[1].identifier+'](/app/issues/'+issues[1].identifier+') — synthetic-vector-9203\n\n'+
   '## [synthetic-vector-9201](/app/projects/'+beta.id+')\n\n'+
   '- ['+issues[2].identifier+'](/app/issues/'+issues[2].identifier+') — synthetic-vector-9204\n'+
   '- ['+issues[3].identifier+'](/app/issues/'+issues[3].identifier+') — synthetic-vector-9205\n');
  for(const excluded of ['synthetic-vector-9208','synthetic-vector-9209','synthetic-vector-9210'])expect(draft.body).not.toContain(excluded);
  const edited=draft.body.replace('synthetic-vector-9203','synthetic-vector-9214 approved human line')+'\n';
  const generated=draft;
  draft=(await json(await owner.call(door,'PATCH',{expectedReleaseVersion:release.version,expectedVersion:draft.version,body:edited}))).draft;
  expect(draft.body).toBe(edited);expect(draft.version).toBe(2);
  expect((await json(await owner.call(door))).draft).toEqual(draft);
  const revisions=(await env.DB.prepare('SELECT version,owner_operator_id,actor_operator_id,body FROM release_note_revisions WHERE release_id=? ORDER BY version').bind(release.id).all()).results;
  expect(revisions).toEqual([
   {version:1,owner_operator_id:w.owner,actor_operator_id:w.owner,body:generated.body},
   {version:2,owner_operator_id:w.owner,actor_operator_id:w.owner,body:edited},
  ]);
  expect(await snapshot(deliveryTables)).toEqual(deliveryBefore);expect(edge).not.toHaveBeenCalled();
 }finally{edge.mockRestore();}
 const noteTables=['release_note_drafts','release_note_revisions','releases','audit_records','administration_audit_details',...deliveryTables];
 const refuse=async(who:Person,path:string,method:string,input:unknown,status:number)=>{
  await resetLimits();const before=await snapshot(noteTables);
  const response=await who.call(path,method,input);
  expect(response.status,await response.clone().text()).toBe(status);
  expect(await snapshot(noteTables)).toEqual(before);
 };
 const edit={expectedReleaseVersion:release.version,expectedVersion:draft.version,body:'synthetic-vector-9215 refused'};
 await refuse(owner,door,'POST',{expectedReleaseVersion:release.version},409);
 await refuse(owner,door,'PATCH',{...edit,expectedVersion:1},409);
 for(const who of [w.admin,w.member]){
  await refuse(who,door,'POST',{expectedReleaseVersion:release.version},403);
  await refuse(who,door,'PATCH',edit,403);
  expect((await json(await who.call(door))).canEdit).toBe(false);
 }
 for(const method of ['GET','POST','PATCH'])await refuse(w.guest,door,method,method==='GET'?undefined:method==='POST'?{expectedReleaseVersion:release.version}:edit,403);
 await json(await owner.call('/settings/operators/'+w.member.id+'/role','PATCH',{role:'viewer',teamIds:[]}));
 expect((await json(await w.member.call(door))).canEdit).toBe(false);
 await refuse(w.member,door,'POST',{expectedReleaseVersion:release.version},403);
 await refuse(w.member,door,'PATCH',edit,403);
 await json(await owner.call('/settings/operators/'+w.member.id+'/role','PATCH',{role:'member',teamIds:[]}));
 release=await json(await owner.call('/releases/'+release.id+'/scope','PUT',{expectedVersion:release.version,issueIdentifiers:[outside.identifier],projectIds:[]}));
 const afterScope=await json(await owner.call(door));
 expect(afterScope.draft.body).toBe(draft.body);expect(afterScope.draft.sources).toEqual(draft.sources);expect(afterScope.releaseChanged).toBe(true);
 await refuse(owner,door,'PATCH',edit,409);
 const continued=(await json(await owner.call(door,'PATCH',{...edit,expectedReleaseVersion:release.version,body:draft.body+'synthetic-vector-9216\n'}))).draft;
 expect(continued.sources).toEqual(draft.sources);expect(continued.sourceReleaseVersion).toBe(draft.sourceReleaseVersion);expect(continued.version).toBe(3);
 const contenders=await Promise.all(['synthetic-vector-9233','synthetic-vector-9234'].map(body=>owner.call(door,'PATCH',{expectedReleaseVersion:release.version,expectedVersion:continued.version,body})));
 expect(contenders.map(r=>r.status).sort()).toEqual([200,409]);
 const winner=(await json(contenders.find(r=>r.status===200)!)).draft;
 expect(['synthetic-vector-9233','synthetic-vector-9234']).toContain(winner.body);
 expect(winner.version).toBe(4);expect((await json(await owner.call(door))).draft).toEqual(winner);
 expect(await env.DB.prepare('SELECT count(*) n FROM release_note_revisions WHERE release_id=?').bind(release.id).first<number>('n')).toBe(4);

 expect((await json(await owner.call('/releases/'+release.id))).description).toBe('synthetic-vector-9213 separate description');
 expect((await json(await owner.call('/releases/'+release.id))).status).toBe('planned');

 // A Member is accountable for a newly created release; workspace Owners do
 // not impersonate that release owner. Current Viewer admission still wins.
 let memberRelease=await json(await w.member.call('/releases','POST',{name:'synthetic-vector-9217',teamId:team.id}),201);
 expect(memberRelease.ownerOperatorId).toBe(w.member.id);
 memberRelease=await json(await w.member.call('/releases/'+memberRelease.id+'/scope','PUT',{expectedVersion:memberRelease.version,issueIdentifiers:issues.map(i=>i.identifier),projectIds:[]}));
 const memberDoor='/releases/'+memberRelease.id+'/notes';
 const memberDraft=(await json(await w.member.call(memberDoor,'POST',{expectedReleaseVersion:memberRelease.version}),201)).draft;
 expect(memberDraft.ownerOperatorId).toBe(w.member.id);expect(memberDraft.authorOperatorId).toBe(w.member.id);
 await refuse(owner,memberDoor,'PATCH',{expectedReleaseVersion:memberRelease.version,expectedVersion:memberDraft.version,body:'synthetic-vector-9218'},403);
 await json(await owner.call('/settings/operators/'+w.member.id+'/role','PATCH',{role:'viewer',teamIds:[]}));
 await refuse(w.member,memberDoor,'PATCH',{expectedReleaseVersion:memberRelease.version,expectedVersion:1,body:'synthetic-vector-9219'},403);
 await json(await owner.call('/settings/operators/'+w.member.id+'/role','PATCH',{role:'member',teamIds:[]}));

 const privateTeam=(await w.mutate('/settings/teams','POST',{name:'synthetic-vector-9220',identifierPrefix:'NOTES',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-9220')!;
 const privateDone=privateTeam.statuses.find(s=>s.category==='completed')!;
 await w.mutate('/settings/teams/'+privateTeam.id+'/members/'+w.member.id,'PUT',{role:'member'});
 const privateIssue=await w.create({teamId:privateTeam.id,statusId:privateDone.id,title:'synthetic-vector-9221 private source'});
 let privateRelease=await json(await w.member.call('/releases','POST',{name:'synthetic-vector-9222'}),201);
 privateRelease=await json(await w.member.call('/releases/'+privateRelease.id+'/scope','PUT',{expectedVersion:privateRelease.version,issueIdentifiers:[privateIssue.identifier,outside.identifier],projectIds:[]}));
 const privateDoor='/releases/'+privateRelease.id+'/notes';
 const privateDraft=(await json(await w.member.call(privateDoor,'POST',{expectedReleaseVersion:privateRelease.version}),201)).draft;
 expect(privateDraft.sources.map((s:any)=>s.id).sort()).toEqual([privateIssue.id,outside.id].sort());
 privateRelease=await json(await w.member.call('/releases/'+privateRelease.id+'/scope','PUT',{expectedVersion:privateRelease.version,issueIdentifiers:[outside.identifier],projectIds:[]}));
 await w.mutate('/settings/teams/'+privateTeam.id+'/members/'+w.member.id,'DELETE');
 for(const method of ['GET','POST','PATCH']){
  await refuse(w.member,privateDoor,method,method==='GET'?undefined:method==='POST'?{expectedReleaseVersion:privateRelease.version}:{expectedReleaseVersion:privateRelease.version,expectedVersion:1,body:privateDraft.body},404);
  const response=await w.member.call(privateDoor);
  const body=await response.text();expect(body).not.toContain(privateIssue.identifier);expect(body).not.toContain('synthetic-vector-9221');
 }
 // A hidden current contribution also refuses generation before any draft is stored.
 let hidden=await json(await owner.call('/releases','POST',{name:'synthetic-vector-9223'}),201);
 hidden=await json(await owner.call('/releases/'+hidden.id+'/scope','PUT',{expectedVersion:hidden.version,issueIdentifiers:[privateIssue.identifier],projectIds:[]}));
 await refuse(w.member,'/releases/'+hidden.id+'/notes','POST',{expectedReleaseVersion:hidden.version},404);
 expect(await env.DB.prepare('SELECT 1 FROM release_note_drafts WHERE release_id=?').bind(hidden.id).first()).toBeNull();

 // A second installation uses its own native Owner session. A release identity
 // from this workspace grants neither reads nor writes in that installation.
 const foreignCookie=await freshTarget();
 const sourceBefore=await snapshot(noteTables);
 const foreignSnapshot=async()=>Promise.all(noteTables.map(async name=>(await destination.ARCHIVE_TARGET_DB.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()).results));
 const foreignBefore=await foreignSnapshot();
 for(const method of ['GET','POST','PATCH']){
  const response=await targetCall('/api'+door,method,method==='GET'?undefined:method==='POST'?{expectedReleaseVersion:release.version}:edit,foreignCookie);
  expect(response.status,await response.clone().text()).toBe(404);
  expect(await response.text()).not.toContain(winner.body);
 }
 expect(await snapshot(noteTables)).toEqual(sourceBefore);expect(await foreignSnapshot()).toEqual(foreignBefore);
 const signedOut=await request('/auth/signout','POST',{},w.member.cookie);expect(signedOut.status).toBe(204);
 await refuse(w.member,memberDoor,'GET',undefined,401);
 await refuse(w.member,memberDoor,'PATCH',{expectedReleaseVersion:memberRelease.version,expectedVersion:1,body:memberDraft.body},401);
 expect((await env.DB.prepare("SELECT count(*) n FROM issue_activity WHERE kind='release.published'").first<number>('n'))).toBe(0);
 // A native draft is incoming work on its imported sources. Rollback must
 // preserve the source and the edited draft rather than cascade its identity.
 const input={format:'json',source:'synthetic-vector-9235',name:'issues.json',mapping:{sourceId:'id',title:'title',team:'team',status:'status'},base64:Buffer.from(JSON.stringify([{id:'synthetic-vector-9236',title:'synthetic-vector-9237',team:team.name,status:done.name}])).toString('base64')};
 const review=await json(await owner.call('/data/import/preview','POST',input));expect(review.ready).toBe(true);expect(review.errors).toEqual([]);
 let run=await json(await owner.call('/data/import/apply','POST',{input:{...input,effectiveAt:review.effectiveAt},reviewedFingerprint:review.fingerprint,operationKey:'synthetic-vector-9238',acknowledgeOmissions:true}));
 for(let n=0;run.state!=='completed';n++){expect(n).toBeLessThan(10);run=await json(await owner.call('/data/import/runs/'+run.id+'/resume','POST',{}));}
 const reconciliation=await json(await owner.call('/data/import/runs/'+run.id+'/report'));
 expect(reconciliation.mapping).toHaveLength(1);
 const imported=[await json(await owner.call('/issues/'+reconciliation.mapping[0].identifier))];
 expect(imported[0].title).toBe('synthetic-vector-9237');
 let importedRelease=await json(await owner.call('/releases','POST',{name:'synthetic-vector-9239'}),201);
 importedRelease=await json(await owner.call('/releases/'+importedRelease.id+'/scope','PUT',{expectedVersion:importedRelease.version,issueIdentifiers:[imported[0].identifier],projectIds:[]}));
 const importedDoor='/releases/'+importedRelease.id+'/notes';
 const importedDraft=(await json(await owner.call(importedDoor,'POST',{expectedReleaseVersion:importedRelease.version}),201)).draft;
 const importedEdit=(await json(await owner.call(importedDoor,'PATCH',{expectedReleaseVersion:importedRelease.version,expectedVersion:1,body:importedDraft.body+'synthetic-vector-9240 human edit\n'}))).draft;
 const rollbackDoor='/data/import/runs/'+run.id+'/rollback';
 const rollback=await json(await owner.call(rollbackDoor));
 expect(rollback.conflicts).toContainEqual(expect.objectContaining({identifier:imported[0].identifier,reasons:['linked']}));
 await refuse(owner,rollbackDoor,'POST',{confirmed:true},409);
 expect((await json(await owner.call(importedDoor))).draft).toEqual(importedEdit);
 expect((await json(await owner.call('/issues/'+imported[0].identifier))).title).toBe('synthetic-vector-9237');
 // Native removal retires identity access. DATA-011 preserves other people's
 // words, including a release owner's explicit mention in their edited notes.
 const memberIdentity=(await json(await owner.call('/settings'))).operators.find((person:any)=>person.id===w.member.id);
 const authoredBody=winner.body+' '+memberIdentity.name;
 const authored=(await json(await owner.call(door,'PATCH',{expectedReleaseVersion:release.version,expectedVersion:winner.version,body:authoredBody}))).draft;
 const retainedHistory=(await env.DB.prepare('SELECT * FROM release_note_revisions ORDER BY release_id,version').all()).results;
 expect((await owner.call('/settings/operators/'+w.member.id,'DELETE')).status).toBe(200);
 const subject={email:memberIdentity.email,names:[memberIdentity.name]};
 const preview=await json(await owner.call('/data/erasure/preview','POST',subject));
 await json(await owner.call('/data/erasure','POST',{subject,confirmation:preview.confirmation}));
 expect((await json(await owner.call(door))).draft).toEqual(authored);
 expect((await json(await owner.call(memberDoor))).draft).toEqual(memberDraft);
 expect((await env.DB.prepare('SELECT * FROM release_note_revisions ORDER BY release_id,version').all()).results).toEqual(retainedHistory);
 const retired=await env.DB.prepare('SELECT name,email,removed_at FROM operators WHERE id=?').bind(w.member.id).first<{name:string;email:string;removed_at:string|null}>();
 expect(retired!.removed_at).not.toBeNull();expect(retired!.name).not.toBe(memberIdentity.name);expect(retired!.email).not.toBe(memberIdentity.email);
 for(const method of ['GET','POST','PATCH'])await refuse(w.member,memberDoor,method,method==='GET'?undefined:method==='POST'?{expectedReleaseVersion:memberRelease.version}:{expectedReleaseVersion:memberRelease.version,expectedVersion:memberDraft.version,body:memberDraft.body},401);
 await refuse(owner,memberDoor,'POST',{expectedReleaseVersion:memberRelease.version},403);

},120000);
