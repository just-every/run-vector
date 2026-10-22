import {expect,it} from 'vitest';
import {populatedHttpSource} from './http-archive-source';
import {destination,freshTarget,targetCall,targetSignIn,targetSnapshot,httpExport,stageArchive,finalBody} from './http-archive-fixture';
import {makePart,type Part} from '@runeditrun/rer/modules/portability';
import {ContentVerifier,ArchiveVerifier} from '@runeditrun/rer/modules/portability/format';

it('[ROLE-005 DATA-001 DATA-005 BASE-DATA-001] aborted or failed restore attempts retain native authority, files and append-only audit history',async()=>{
 const f=await populatedHttpSource(),records=await httpExport(f.call),cookie=await freshTarget(),db=destination.ARCHIVE_TARGET_DB;
 const original=await targetSnapshot();
 const auditBefore=(await db.prepare('SELECT * FROM audit_records ORDER BY id').all()).results;
 const preserved=async()=>{
  expect((await targetSnapshot()).filter(row=>row.table!=='audit_records')).toEqual(original.filter(row=>row.table!=='audit_records'));
  const rows=(await db.prepare('SELECT * FROM audit_records ORDER BY id').all()).results;
  expect(rows.filter(row=>auditBefore.some(prior=>prior.id===row.id))).toEqual(auditBefore);
  for(const row of rows.filter(row=>!auditBefore.some(prior=>prior.id===row.id))) {
    expect(row.action).toBe('archive.import.started');expect(row.id).toBe('archive:'+row.subject_id);expect(row.actor_kind).toBe('person');
  }
 };

 // A pre-existing unowned object is not restore custody and must survive.
 await destination.ARCHIVE_TARGET_FILES.put('unowned-target-object',new Uint8Array([7,8]));
 const occupiedJob=await stageArchive(records,cookie);
 expect((await targetCall('/api/portability/imports/'+occupiedJob+'/finalize','POST',finalBody(records),cookie)).status).toBe(409);
 await preserved();
 expect(new Uint8Array(await (await destination.ARCHIVE_TARGET_FILES.get('unowned-target-object'))!.arrayBuffer())).toEqual(new Uint8Array([7,8]));
 expect((await targetCall('/api/portability/imports/'+occupiedJob+'/abort','POST',{},cookie)).status).toBe(200);
 expect(new Uint8Array(await (await destination.ARCHIVE_TARGET_FILES.get('unowned-target-object'))!.arrayBuffer())).toEqual(new Uint8Array([7,8]));
 await destination.ARCHIVE_TARGET_FILES.delete('unowned-target-object');
 const checksumJob=await stageArchive(records,cookie);
 expect((await targetCall('/api/portability/imports/'+checksumJob+'/finalize','POST',{...finalBody(records),contentHash:'0'.repeat(64)},cookie)).status).toBe(400);
 await preserved();
 expect((await targetCall('/api/portability/imports/'+checksumJob+'/abort','POST',{},cookie)).status).toBe(200);
 expect((await targetCall('/api/session','GET',undefined,cookie)).status).toBe(200);
 const broken=structuredClone(records),verifier=new ContentVerifier(broken[0] as import('@runeditrun/rer/modules/portability').Manifest),archive=new ArchiveVerifier(broken[0] as import('@runeditrun/rer/modules/portability').Manifest);
 for(let i=0;i<broken.length;i++)if(broken[i].kind==='part') {
  const part=broken[i] as Part;
  for(const item of part.items)if(item.kind==='row'&&item.table==='issue_files')item.row.actor_operator_id='absent-native-operator';
  broken[i]=await makePart(part.index,part.items);archive.add(broken[i]);for(const item of part.items)verifier.add(item);
 }
 const badJob=await stageArchive(broken,cookie);
 const failure=await targetCall('/api/portability/imports/'+badJob+'/finalize','POST',{contentHash:verifier.digest(),archiveHash:archive.digest()},cookie);expect(failure.status).toBe(500);
 await preserved();expect((await destination.ARCHIVE_TARGET_FILES.list()).objects).toEqual([]);
 expect((await targetCall('/api/session','GET',undefined,cookie)).status).toBe(200);
 expect((await targetCall('/api/portability/imports/'+badJob+'/abort','POST',{},cookie)).status).toBe(200);
 const realSecond=await targetSignIn();expect((await targetCall('/api/session','GET',undefined,realSecond)).status).toBe(200);expect((await targetCall('/api/portability/imports','POST',{confirmed:true,manifest:records[0]},cookie)).status).toBe(409);
},180000);
