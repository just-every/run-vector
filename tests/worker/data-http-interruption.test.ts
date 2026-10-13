import {expect,it} from 'vitest';
import {populatedHttpSource} from './http-archive-source';
import {freshTarget,targetCall,httpExport,destination,type ArchiveRecords} from './http-archive-fixture';
import {interruptAt} from './http-archive-interrupt';
import type {Part} from '@runeditrun/rer/modules/portability';

it('[DATA-001 DATA-005 BASE-DATA-001] an HTTP restore interrupted before any R2 settlement resumes or aborts, and frees the workspace',async()=>{
 const f=await populatedHttpSource(),records:ArchiveRecords=await httpExport(f.call),cookie=await freshTarget();
 const team=await destination.ARCHIVE_TARGET_DB.prepare('SELECT id FROM teams LIMIT 1').first<string>('id');
 const create=()=>targetCall('/api/portability/imports','POST',{confirmed:true,manifest:records[0]},cookie);
 // A reset after the destination reservation, before Base records a job.
 const {reset}=await interruptAt(/^INSERT INTO rer_portability_jobs/,'reset');
 const cut=create();await reset();expect((await cut).status).toBe(500);
 const created=await create();expect(created.status,await created.clone().text()).toBe(201);
 const {id}=await created.json() as {id:string};
 // One transient D1 failure in validation before the first part is stored.
 const parts=records.filter((row):row is Part=>row.kind==='part');
 await interruptAt(/sqlite_master/,'error');
 expect((await targetCall('/api/portability/imports/'+id+'/parts/0','PUT',parts[0],cookie)).status).toBe(500);
 for(const part of parts)expect((await targetCall('/api/portability/imports/'+id+'/parts/'+part.index,'PUT',part,cookie)).status).toBe(200);
 expect((await targetCall('/api/issues','POST',{title:'Write during restore',teamId:team},cookie)).status).toBe(409);
 expect((await targetCall('/api/portability/imports/'+id+'/abort','POST',{},cookie)).status).toBe(200);
 expect((await targetCall('/api/issues','POST',{title:'Write after abort',teamId:team},cookie)).status).toBe(201);
},180000);

