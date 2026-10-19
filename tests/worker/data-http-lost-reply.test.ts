import {expect,it} from 'vitest';
import {populatedHttpSource} from './http-archive-source';
import {destination,freshTarget,targetCall,targetSignIn,httpExport,type ArchiveRecords} from './http-archive-fixture';
import {interruptAt} from './http-archive-interrupt';

it('[DATA-001 DATA-005] a create whose job committed but whose reply was lost returns that job to its own session only',async()=>{
 const f=await populatedHttpSource(),records:ArchiveRecords=await httpExport(f.call),cookie=await freshTarget();
 const team=await destination.ARCHIVE_TARGET_DB.prepare('SELECT id FROM teams LIMIT 1').first<string>('id');
 const create=(session=cookie)=>targetCall('/api/portability/imports','POST',{confirmed:true,manifest:records[0]},session);
 const bound=()=>destination.ARCHIVE_TARGET_DB.prepare('SELECT import_id FROM vector_http_restore').first<string>('import_id');
 // A coordinator reset right after the job and its reservation binding commit.
 const {reset}=await interruptAt(/^INSERT INTO rer_portability_jobs/,'reset',true);
 const cut=create();await reset();expect((await cut).status).toBe(500);
 const first=await bound();expect(first).toMatch(/^[0-9a-f-]{36}$/);
 const again=await create();expect(again.status,await again.clone().text()).toBe(200);
 expect(await again.json()).toEqual({id:first});
 // Abort releases the reservation; then a transient error after the commit,
 // which Base reports as import_running, is answered the same way.
 expect((await targetCall('/api/portability/imports/'+first+'/abort','POST',{},cookie)).status).toBe(200);
 await interruptAt(/^INSERT INTO rer_portability_jobs/,'error',true);
 // Base names the running job and when it may be aborted; it is this session's own reservation.
 const lost=await create();expect(lost.status).toBe(409);const running=await lost.json();
 const second=await bound();expect(second).not.toBe(first);
 expect(running).toEqual({error:'import_running',jobId:second,abortableAt:expect.stringMatching(/^\d{4}-\d\d-\d\dT/)});
 const repeated=await create();expect(repeated.status).toBe(200);expect(await repeated.json()).toEqual({id:second});
 // A different manifest, or another session of the same owner, is still refused.
 const changed=await targetCall('/api/portability/imports','POST',{confirmed:true,manifest:{...records[0],exportedAt:'2000-01-01T00:00:00.000Z'}},cookie);
 expect(changed.status).toBe(409);
 const other=await targetSignIn();
 const refused=await create(other);expect(refused.status).toBe(409);expect(await bound()).toBe(second);
 expect((await targetCall('/api/portability/imports/'+second+'/abort','POST',{},cookie)).status).toBe(200);
 expect((await targetCall('/api/issues','POST',{title:'Write after abort',teamId:team},cookie)).status).toBe(201);
},180000);
