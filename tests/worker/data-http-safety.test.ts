import {expect,it} from 'vitest';
import {populatedHttpSource} from './http-archive-source';
import {destination,freshTarget,targetCall,targetSnapshot,httpExport,finalBody} from './http-archive-fixture';

it('[DATA-001 DATA-005 BASE-DATA-001] HTTP admission refuses extra authority or edited bootstrap and retains the audit history of added authority',async()=>{
 const f=await populatedHttpSource(),records=await httpExport(f.call),cookie=await freshTarget(),db=destination.ARCHIVE_TARGET_DB;
 const initial=await targetSnapshot();
 const initialAudit=(await (await targetCall('/api/settings/audit','GET',undefined,cookie)).json() as {entries:{id:string;action:string}[]}).entries;
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
 // Reverting a fixture's credential rows does not erase its recorded admission.
 const afterAudit=(await (await targetCall('/api/settings/audit','GET',undefined,cookie)).json() as {entries:{id:string;action:string}[]}).entries;
 expect(afterAudit.filter(row=>initialAudit.some(prior=>prior.id===row.id))).toEqual(initialAudit);
 expect(afterAudit.filter(row=>!initialAudit.some(prior=>prior.id===row.id)).map(row=>[row.id,row.action]).sort()).toEqual([['joined:extra-operator','operator.joined'],['signin:extra-session','auth.signed_in']]);
 expect((await targetSnapshot()).filter(row=>!['issue_list_revision','audit_records'].includes(row.table))).toEqual(initial.filter(row=>!['issue_list_revision','audit_records'].includes(row.table)));
 await denied(); // Retained extra authority history itself makes this target non-pristine.
},180000);
