import {expect,it} from 'vitest';
import {expectAuditArchiveHistory} from './audit-archive';
import {setupAdministration} from './administration-fixture';
import {destination,freshTarget,targetCall,targetSignIn,httpExport,stageArchive,finalBody} from './http-archive-fixture';
import {makePart,type Part,type Manifest,type Closing} from '@runeditrun/rer/modules/portability';
import {ContentVerifier,ArchiveVerifier} from '@runeditrun/rer/modules/portability/format';

it('[DATA-001 DATA-005 BASE-DATA-001] matching restored native identity and authority version never revive the consumed bootstrap session',async()=>{
 const f=await setupAdministration();await f.create();
 const records=await httpExport(f.call),cookie=await freshTarget();
 const actor=await destination.ARCHIVE_TARGET_DB.prepare('SELECT id FROM operators').first<string>('id');
 // Synthetic identity collision in test archive only. The product receives the
 // same complete validated archive format and has no special collision path.
 const verifier=new ContentVerifier(records[0] as Manifest),archive=new ArchiveVerifier(records[0] as Manifest);
 for(let i=0;i<records.length;i++)if(records[i].kind==='part') {
  const part=records[i] as Part;
  for(const item of part.items)if(item.kind==='row')for(const key of Object.keys(item.row))if(item.row[key]===f.owner)item.row[key]=actor!;
  records[i]=await makePart(part.index,part.items);archive.add(records[i]);for(const item of part.items)verifier.add(item);
 }
 (records.at(-1) as Closing).contentHash=verifier.digest();
 (records.at(-1) as Closing & {archiveHash:string}).archiveHash=archive.digest();
 const job=await stageArchive(records,cookie),response=await targetCall('/api/portability/imports/'+job+'/finalize','POST',finalBody(records),cookie);
 expect(response.status,await response.clone().text()).toBe(200);
 expect((await targetCall('/api/session','GET',undefined,cookie)).status).toBe(401);
 expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT count(*) AS n FROM oa_sessions').first())?.n).toBe(0);
 expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT count(*) AS n FROM oa_tokens').first())?.n).toBe(0);
 const fresh=await targetSignIn();expect((await targetCall('/api/session','GET',undefined,fresh)).status).toBe(200);
 const next=await httpExport((path,method,body)=>targetCall('/api'+path,method,body,fresh));expectAuditArchiveHistory(records,next);
},180000);
