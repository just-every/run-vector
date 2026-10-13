import {expect,it} from 'vitest';
import {populatedHttpSource} from './http-archive-source';
import {destination,freshTarget,targetCall,targetSignIn,targetSnapshot,httpExport,stageArchive,finalHash,finalBody} from './http-archive-fixture';
import {makePart,type Part} from '../../scripts/base-cli/modules/portability/index.mjs';
import {ContentVerifier,ArchiveVerifier} from '../../scripts/base-cli/modules/portability/format.mjs';

it('[DATA-001 DATA-005 BASE-DATA-001] HTTP admission refuses extra authority or edited bootstrap; abort, corrupt content and late D1 failure retain authority and files',async()=>{
 const f=await populatedHttpSource(),records=await httpExport(f.call),cookie=await freshTarget(),db=destination.ARCHIVE_TARGET_DB;
 const initial=await targetSnapshot();
 const denied=async(status=409)=>{
  const before=await targetSnapshot();
  expect((await targetCall('/api/portability/imports','POST',{confirmed:true,manifest:records[0]},cookie)).status).toBe(status);
  expect(await targetSnapshot()).toEqual(before);expect((await destination.ARCHIVE_TARGET_FILES.list()).objects).toEqual([]);
 };
 const variants=[
  ["UPDATE workspace_settings SET reminder_time='10:15'", "UPDATE workspace_settings SET reminder_time='09:00'"],
  ["UPDATE workspace_settings SET name=name||' edited'", "UPDATE workspace_settings SET name=substr(name,1,length(name)-7)"],
  ["UPDATE workspace_installation SET setup_completed_at='2026-10-01T00:00:00Z'",'UPDATE workspace_installation SET setup_completed_at=NULL'],
  ["INSERT INTO oa_tokens SELECT 'extra-token','extra-token-hash',kind,operator_id,operator_version,issuer_id,issuer_version,return_to,created_at,expires_at,consumed_at,revoked_at FROM oa_tokens LIMIT 1","DELETE FROM oa_tokens WHERE id='extra-token'"],
  ["INSERT INTO oa_sessions SELECT 'extra-session','extra-session-hash',operator_id,operator_version,kind,NULL,created_at,expires_at,revoked_at FROM oa_sessions LIMIT 1","DELETE FROM oa_sessions WHERE id='extra-session'"],
  ["INSERT INTO oa_external_identities SELECT 'https://identity.example','external',id FROM oa_operators","DELETE FROM oa_external_identities WHERE subject='external'"],
  ["INSERT INTO oa_dev_credentials VALUES('session','dev-fixture',0)","DELETE FROM oa_dev_credentials WHERE id='dev-fixture'"],
  ["INSERT INTO oa_invitation_cancellations SELECT id,version FROM oa_operators",'DELETE FROM oa_invitation_cancellations'],
  ["INSERT INTO issue_deletions SELECT 'existing-deletion','BASE-99',id,'2026-09-02T00:00:00Z' FROM workspace_settings", "DELETE FROM issue_deletions WHERE issue_id='existing-deletion'"],
  ["INSERT INTO vector_webhook_erasures SELECT id,'existing-erasure','BASE-99','2026-09-02T00:00:00Z' FROM workspace_settings", "DELETE FROM vector_webhook_erasures WHERE id='existing-erasure'"],
 ];
 for(const [change,undo] of variants){await db.prepare(change).run();await denied();await db.prepare(undo).run();}
 const expires=await db.prepare('SELECT expires_at FROM oa_sessions').first<number>('expires_at');
 await db.prepare('UPDATE oa_sessions SET expires_at=0').run();await denied(401);await db.prepare('UPDATE oa_sessions SET expires_at=?').bind(expires).run();
 await db.prepare('UPDATE oa_operators SET version=version+1').run();await denied(401);await db.prepare('UPDATE oa_operators SET version=version-1').run();
 await db.prepare("INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) SELECT 'extra-operator',workspace_id,'Extra','extra@target.test',created_at,updated_at FROM operators LIMIT 1").run();await denied();
 await db.batch([db.prepare("DELETE FROM vector_auth_operators WHERE operator_id='extra-operator'"),db.prepare("DELETE FROM oa_operators WHERE id='extra-operator'"),db.prepare("DELETE FROM operators WHERE id='extra-operator'")]);
 await db.prepare("INSERT INTO operator_sessions(id,operator_id,token_hash,expires_at,created_at,updated_at) SELECT 'legacy-session',id,'legacy-hash','2099-01-01T00:00:00Z',created_at,updated_at FROM operators LIMIT 1").run();await denied();await db.prepare("DELETE FROM operator_sessions WHERE id='legacy-session'").run();
 // The separately authorized fixture edits increment the conservative list
 // revision. All other native state was restored before the rollback cases.
 expect((await targetSnapshot()).filter(row=>row.table!=='issue_list_revision')).toEqual(initial.filter(row=>row.table!=='issue_list_revision'));
 const original=await targetSnapshot();
 // A pre-existing unowned object is not restore custody and must survive.
 await destination.ARCHIVE_TARGET_FILES.put('unowned-target-object',new Uint8Array([7,8]));
 const occupiedJob=await stageArchive(records,cookie);
 expect((await targetCall('/api/portability/imports/'+occupiedJob+'/finalize','POST',finalBody(records),cookie)).status).toBe(409);
 expect(await targetSnapshot()).toEqual(original);
 expect(new Uint8Array(await (await destination.ARCHIVE_TARGET_FILES.get('unowned-target-object'))!.arrayBuffer())).toEqual(new Uint8Array([7,8]));
 expect((await targetCall('/api/portability/imports/'+occupiedJob+'/abort','POST',{},cookie)).status).toBe(200);
 expect(new Uint8Array(await (await destination.ARCHIVE_TARGET_FILES.get('unowned-target-object'))!.arrayBuffer())).toEqual(new Uint8Array([7,8]));
 await destination.ARCHIVE_TARGET_FILES.delete('unowned-target-object');
 const checksumJob=await stageArchive(records,cookie);
 expect((await targetCall('/api/portability/imports/'+checksumJob+'/finalize','POST',{...finalBody(records),contentHash:'0'.repeat(64)},cookie)).status).toBe(400);
 expect(await targetSnapshot()).toEqual(original);
 expect((await targetCall('/api/portability/imports/'+checksumJob+'/abort','POST',{},cookie)).status).toBe(200);
 expect((await targetCall('/api/session','GET',undefined,cookie)).status).toBe(200);
 const broken=structuredClone(records),verifier=new ContentVerifier(broken[0] as import('../../scripts/base-cli/modules/portability/index.mjs').Manifest),archive=new ArchiveVerifier(broken[0] as import('../../scripts/base-cli/modules/portability/index.mjs').Manifest);
 for(let i=0;i<broken.length;i++)if(broken[i].kind==='part') {
  const part=broken[i] as Part;
  for(const item of part.items)if(item.kind==='row'&&item.table==='issue_files')item.row.actor_operator_id='absent-native-operator';
  broken[i]=await makePart(part.index,part.items);archive.add(broken[i]);for(const item of part.items)verifier.add(item);
 }
 const badJob=await stageArchive(broken,cookie);
 const failure=await targetCall('/api/portability/imports/'+badJob+'/finalize','POST',{contentHash:verifier.digest(),archiveHash:archive.digest()},cookie);expect(failure.status).toBe(500);
 expect(await targetSnapshot()).toEqual(original);expect((await destination.ARCHIVE_TARGET_FILES.list()).objects).toEqual([]);
 expect((await targetCall('/api/session','GET',undefined,cookie)).status).toBe(200);
 expect((await targetCall('/api/portability/imports/'+badJob+'/abort','POST',{},cookie)).status).toBe(200);
 const realSecond=await targetSignIn();expect((await targetCall('/api/session','GET',undefined,realSecond)).status).toBe(200);await denied();
},180000);
