import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import type { setupImport } from './data-import-fixture';
import type { ImportJob } from '../../vendor/base/import-kit/src/d1/index';

/** Multiple queued plans and native issue creation share the durable namespace. */
export async function checkQueuedReservations(f:Awaited<ReturnType<typeof setupImport>>) {
 const input=f.input(Array.from({length:100},(_,i)=>f.row('reserved-'+i)),'reserved-first');
 const review=await f.preview(input),created=await f.apply(input,review);expect(created.status).toBe(200);
 const first=await created.json() as ImportJob;
 const secondInput=f.input([f.row('other-queue')],'reserved-second'),secondReview=await f.preview(secondInput);
 const queued=await f.apply(secondInput,secondReview);expect(queued.status).toBe(200);const second=await queued.json() as ImportJob;
 const published=await f.call('/data/import/runs/'+first.id+'/resume','POST',{});expect(published.status).toBe(200);
 const partial=await published.json() as ImportJob;expect(partial.checkpoint).toBeGreaterThan(0);expect(partial.checkpoint).toBeLessThan(100);
 const native=await f.create({title:'Native while two imports are queued'});
 expect((await f.finish(second)).state).toBe('completed');expect((await f.finish(partial)).state).toBe('completed');
 expect((await f.apply(input,review)).status).toBe(200);
 const mappings=[];for(const id of [first.id,second.id]){const response=await f.call('/data/import/runs/'+id+'/report');expect(response.status).toBe(200);mappings.push(...(await response.json() as {mapping:{identifier:string}[]}).mapping);}
 expect(mappings).toHaveLength(101);expect(new Set(mappings.map(row=>row.identifier)).size).toBe(101);expect(mappings.some(row=>row.identifier===native.identifier)).toBe(false);
 const floor=Number(native.identifier.split('-').at(-1));expect(mappings.every(row=>Number(row.identifier.split('-').at(-1))<floor)).toBe(true);
 const snapshot=(await env.DB.prepare('SELECT * FROM ik_jobs WHERE id=?').bind(first.id).first())!;
 for(const [field,value] of [['namespace','other-product:source'],['destination','other-workspace'],['principal_id','other-operator']]){
  await env.DB.prepare(`UPDATE ik_jobs SET ${field}=? WHERE id=?`).bind(value,first.id).run();
  for(const suffix of ['','/originals','/report','/report.csv','/rollback'])expect((await f.call('/data/import/runs/'+first.id+suffix)).status).toBe(409);
  expect((await f.call('/data/import/runs/'+first.id+'/resume','POST',{})).status).toBe(409);
  await env.DB.prepare(`UPDATE ik_jobs SET ${field}=? WHERE id=?`).bind(snapshot[field],first.id).run();
 }
 // A native edit blocks the entire rollback before the first reverse batch.
 expect((await f.call('/issues/'+mappings[0].identifier,'PATCH',{expectedVersion:1,title:'Keep this later edit'})).status).toBe(200);
 const before=(await env.DB.prepare('SELECT id,title FROM issues ORDER BY id').all()).results;
 expect((await f.call('/data/import/runs/'+first.id+'/rollback','POST',{confirmed:true})).status).toBe(409);
 expect((await env.DB.prepare('SELECT id,title FROM issues ORDER BY id').all()).results).toEqual(before);
 // The other queued run reverses safely, without rewinding native identifiers.
 expect((await f.call('/data/import/runs/'+second.id+'/rollback','POST',{})).status).toBe(400);
 expect((await f.call('/data/import/runs/'+second.id+'/rollback','POST',{confirmed:true})).status).toBe(200);
 const after=await f.create();expect(Number(after.identifier.split('-').at(-1))).toBeGreaterThan(floor);
 // Concurrent reviews either reserve distinct ranges or refuse stale review,
 // never create an unusable second job.
 const a=f.input([f.row('race-a')],'race-a'),b=f.input([f.row('race-b')],'race-b');
 const [ra,rb]=await Promise.all([f.preview(a),f.preview(b)]);
 const responses=await Promise.all([f.apply(a,ra),f.apply(b,rb)]);
 expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
 const winner=await responses.find(r=>r.status===200)!.json() as ImportJob;await f.finish(winner);
 const loser=responses[0].status===409?a:b;await f.publish(loser);
 // Losing the session inside reservation creation rolls back job, ranges and
 // metadata as one transaction; the same reviewed request can then succeed.
 const fenced=f.input([f.row('create-fence')],'create-fence'),fencedReview=await f.preview(fenced);
 const beforeJobs=await env.DB.prepare('SELECT count(*) n FROM ik_jobs').first<number>('n');
 const beforeRanges=(await env.DB.prepare('SELECT * FROM vector_import_allocations ORDER BY job_id,identifier_prefix').all()).results;
 const beforeFloor=(await env.DB.prepare('SELECT * FROM issue_prefix_sequences ORDER BY workspace_id,identifier_prefix').all()).results;
 await env.DB.prepare("CREATE TRIGGER reservation_revokes_session AFTER INSERT ON vector_import_allocations BEGIN UPDATE oa_sessions SET revoked_at=1 WHERE revoked_at IS NULL; END").run();
 expect((await f.apply(fenced,fencedReview)).status).toBe(503);
 expect(await env.DB.prepare('SELECT count(*) n FROM ik_jobs').first<number>('n')).toBe(beforeJobs);
 expect((await env.DB.prepare('SELECT * FROM vector_import_allocations ORDER BY job_id,identifier_prefix').all()).results).toEqual(beforeRanges);
 expect((await env.DB.prepare('SELECT * FROM issue_prefix_sequences ORDER BY workspace_id,identifier_prefix').all()).results).toEqual(beforeFloor);
 await env.DB.prepare('DROP TRIGGER reservation_revokes_session').run();
 const admitted=await f.apply(fenced,fencedReview);expect(admitted.status).toBe(200);await f.finish(await admitted.json() as ImportJob);

}
