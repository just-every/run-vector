import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { setupLinearWorkspace } from './linear-workspace-fixture';
import { setupErasureRollbackTeams } from './erasure-rollback-fixture';
import { generateLinearWorkspace } from '../fixtures/import/linear/generate.mjs';
import { destination, finalBody, freshTarget, httpExport, stageArchive, targetCall } from './http-archive-fixture';
import { holders } from './sentinel-scan';
import type { ImportInput } from '../../src/core/features/data/import/types';

const STRANGER = 'Quentin Erasewell', NEEDLES = ['quentin erasewell', 'maya chen', 'maya@base.test'];
const count = async (sql: string, ...params: unknown[]) => (await env.DB.prepare(sql).bind(...params).first<number>('n')) ?? 0;

it('[DATA-004 DATA-009 BASE-DATA-003] person erasure preserves rollback survivors, clears applied and pending custody, and fences older archives', async () => {
  const f = await setupLinearWorkspace(10);
  const teams = [{ key: 'ENG', name: 'Engineering', cycles: ['Cycle 41', 'Cycle 42'] }, { key: 'OPS', name: 'Operations', cycles: [] }];
  const pair = (issues: number, seed: number, source: string): ImportInput => {
    const generated = generateLinearWorkspace({ issues, seed, teams, people: ['Owner', 'Maya Chen'], strangers: [STRANGER], labels: ['Bug', 'Customer'], projects: ['Migration'] });
    return { ...f.input(generated.csv, source), format: 'linear-api-json', api: { name: 'linear-api.json', base64: Buffer.from(JSON.stringify(generated.api)).toString('base64') } };
  };
  // One run applied whole, one stopped after its first batches.
  const applied = pair(120, 31, 'linear-applied');
  let run = await f.createRun(applied, await f.preview(applied));
  while (run.progress.unfinished) run = await f.resume(run);
  expect(run.state).toBe('completed');
  const pendingInput = pair(150, 47, 'linear-pending');
  let pending = await f.resume(await f.createRun(pendingInput, await f.preview(pendingInput)));
  expect(pending.progress.unfinished).toBe(true);
  const written = { applied: await count('SELECT count(*) AS n FROM ik_provenance WHERE job_id=?', run.id), pending: await count('SELECT count(*) AS n FROM ik_provenance WHERE job_id=?', pending.id) };
  expect(written.applied).toBeGreaterThanOrEqual(120);expect(written.pending).toBeGreaterThan(0);
  // The same workspace and person erasure cover all runs. Rollback uses real
  // separate teams so it cannot consume the pending run's future identifiers.
  const rollbackFixture=await setupErasureRollbackTeams(f,STRANGER);
  const json=async(path:string,method='GET',body?:unknown,status=200)=>{const response=await f.call(path,method,body);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;};
  const original=rollbackFixture.input(80,20261012,'erasure-r1');let complete=await f.createRun(original,await f.preview(original));
  while(complete.progress.unfinished)complete=await f.resume(complete);
  const reusedReview=await f.preview(original),reusedResponse=await f.apply(original,reusedReview,'reused-source-run');
  expect(reusedResponse.status,await reusedResponse.clone().text()).toBe(200);
  let reused=await reusedResponse.json() as typeof complete;while(reused.progress.unfinished)reused=await f.resume(reused);
  const rollbackInput=rollbackFixture.input(150,47,'erasure-r6');let rollbackPending=await f.resume(await f.createRun(rollbackInput,await f.preview(rollbackInput)));
  expect(complete.state).toBe('completed');
  expect(rollbackPending.progress.unfinished).toBe(true);
  const owned=async(id:string)=>(await env.DB.prepare(`SELECT i.identifier FROM issues i JOIN ik_provenance p ON p.target_id=i.id WHERE p.job_id=? AND p.target_kind='issue' AND p.reversed=0 ORDER BY i.identifier`).bind(id).all<{identifier:string}>()).results.map(row=>row.identifier);
  const beforeComplete=await owned(complete.id),beforeRollbackPending=await owned(rollbackPending.id);
  expect((await json('/data/import/runs/'+complete.id+'/rollback')).conflicts).toEqual([]);
  const before = await holders(env.DB, NEEDLES, env.FILES);
  for (const table of ['issue_comments', 'vector_import_reports', 'oa_operators', 'ik_d1_plan_chunks', 'ik_d1_original_chunks']) expect(Object.keys(before), table).toContain(table);
  const older = await httpExport(f.call);

  // A stranger who never had an account, by the exact name the files carried.
  const journalIds=async()=>((await json('/data/erasure/journal')).entries as {receiptId:string}[]).map(entry=>entry.receiptId).sort();
  const beforeStrangerJournal=await journalIds();
  const stranger = { names: [STRANGER] };
  const preview = await f.call('/data/erasure/preview', 'POST', stranger);
  expect(preview.status, await preview.clone().text()).toBe(200);
  const shown = await preview.json() as { imported: { comments: number; reports: number }; confirmation: string };
  expect(shown.imported.comments).toBeGreaterThan(0);expect(shown.imported.reports).toBeGreaterThan(0);
  expect((await f.call('/data/erasure', 'POST', { subject: stranger, confirmation: 'erase someone' })).status).toBe(400);
  const strangerErased = await f.call('/data/erasure', 'POST', { subject: stranger, confirmation: shown.confirmation });
  expect(strangerErased.status, await strangerErased.clone().text()).toBe(200);
  const first = await strangerErased.json() as { journal: { receiptId:string;recordsErased: number } };
  expect(first.journal.recordsErased).toBeGreaterThan(0);
  expect(await journalIds()).toEqual([...beforeStrangerJournal,first.journal.receiptId].sort());

  // Erasure alone detaches issues; incoming links must explain rollback refusal
  // before removal or native edits can introduce a different conflict.
  expect(await count("SELECT count(*) AS n FROM issue_activity WHERE kind<>'issue.imported'")).toBe(0);
  const remainingComplete=new Set(await owned(complete.id)),remainingPending=new Set(await owned(rollbackPending.id));
  const detachedComplete=beforeComplete.filter(id=>!remainingComplete.has(id)),detachedPending=beforeRollbackPending.filter(id=>!remainingPending.has(id));
  const blocked=await json('/data/import/runs/'+complete.id+'/rollback');
  expect(blocked.detachedIdentifiers).toEqual(detachedComplete);expect(blocked.detachedIssues).toBe(detachedComplete.length);
  expect(blocked.conflicts.length).toBeGreaterThan(0);
  for(const conflict of blocked.conflicts){expect(conflict.reasons).toEqual(['erasure_detached']);expect(conflict.detachedIdentifiers.length).toBeGreaterThan(0);}
  const refusedRollback=await json('/data/import/runs/'+complete.id+'/rollback','POST',{confirmed:true},409);
  expect(refusedRollback.conflicts).toEqual(blocked.conflicts);expect(refusedRollback.detachedIdentifiers).toEqual(detachedComplete);
  expect((await json('/data/import/runs/'+reused.id+'/rollback')).detachedIdentifiers).toEqual([]);
  expect(await holders(env.DB,[STRANGER.toLowerCase()],env.FILES)).toEqual({});
  const pendingPreview=await json('/data/import/runs/'+rollbackPending.id+'/rollback');
  expect(pendingPreview.conflicts).toEqual([]);expect(detachedPending.length).toBeGreaterThan(0);
  expect(pendingPreview.detachedIdentifiers).toEqual(detachedPending);
  let rolled=await json('/data/import/runs/'+rollbackPending.id+'/rollback','POST',{confirmed:true});
  while(rolled.progress.unfinished)rolled=await json('/data/import/runs/'+rollbackPending.id+'/resume','POST',{});
  expect(rolled.state).toBe('rolled_back');expect(rolled.progress.issuesRemaining).toBe(0);
  expect(rolled.progress.detachedIssues).toBe(detachedPending.length);expect(rolled.progress.detachedIdentifiers).toEqual(detachedPending);
  const survivingIdentifiers=async(identifiers:string[])=>(await env.DB.prepare('SELECT identifier FROM issues WHERE identifier IN (SELECT value FROM json_each(?)) ORDER BY identifier').bind(JSON.stringify(identifiers)).all<{identifier:string}>()).results.map(row=>row.identifier);
  expect(await survivingIdentifiers(beforeRollbackPending)).toEqual(detachedPending);
  expect((await json('/data/import/runs/'+rollbackPending.id)).progress.detachedIdentifiers).toEqual(detachedPending);
  const list=await json('/data/import/runs');expect(list.runs.find((row:any)=>row.id===rollbackPending.id).detachedIdentifiers).toEqual(detachedPending);
  // A detached child's unrelated edit is not a new relationship, but a native
  // parent assignment must retain both the survivor and the later-work cause.
  const parent=blocked.conflicts[0].identifier;
  let detachedChild=await json('/issues/'+blocked.conflicts[0].detachedIdentifiers[0]);
  await json('/issues/'+detachedChild.identifier,'PATCH',{expectedVersion:detachedChild.version,title:'Retained issue edited after erasure'});
  const unrelated=await json('/data/import/runs/'+complete.id+'/rollback');
  expect(unrelated.conflicts.find((row:any)=>row.identifier===parent).reasons).toEqual(['erasure_detached']);
  const nextParent=await env.DB.prepare(`SELECT i.identifier FROM issues i JOIN ik_provenance p ON p.target_id=i.id
    WHERE p.job_id=? AND p.target_kind='issue' AND p.reversed=0 AND i.identifier<>?
    AND NOT EXISTS(SELECT 1 FROM issue_parents relation WHERE relation.issue_id=i.id) ORDER BY i.identifier LIMIT 1`).bind(complete.id,parent).first<string>('identifier');
  expect(nextParent).not.toBeNull();
  detachedChild=await json('/issues/'+detachedChild.identifier);
  await json('/issues/'+detachedChild.identifier+'/parent','PATCH',{expectedVersion:detachedChild.version,parentIdentifier:nextParent});
  const relinked=await json('/data/import/runs/'+complete.id+'/rollback');
  const relinkedConflict=relinked.conflicts.find((row:any)=>row.identifier===nextParent);
  expect(relinkedConflict.reasons).toEqual(['linked','erasure_detached']);
  expect(relinkedConflict.detachedIdentifiers).toContain(detachedChild.identifier);
  const relinkedRefusal=await json('/data/import/runs/'+complete.id+'/rollback','POST',{confirmed:true},409);
  expect(relinkedRefusal.conflicts).toEqual(relinked.conflicts);
  expect(relinkedRefusal.detachedIdentifiers).toEqual(detachedComplete);
  // A newly created native child independently blocks its imported parent.
  const native=await json('/issues','POST',{title:'Later native child',teamId:rollbackFixture.nativeTeamId},201);
  await json('/issues/'+native.identifier+'/parent','PATCH',{expectedVersion:native.version,parentIdentifier:parent});
  const laterWork=await json('/data/import/runs/'+complete.id+'/rollback');
  expect(laterWork.conflicts.find((row:any)=>row.identifier===parent).reasons).toContain('linked');
  await json('/data/import/runs/'+complete.id+'/rollback','POST',{confirmed:true},409);
  const nativeNow=await json('/issues/'+native.identifier);
  await json('/issues/'+native.identifier,'DELETE',{expectedVersion:nativeNow.version,confirmed:true});
  // Discover every current incoming relationship, including the native parent
  // above, and remove it through its public action while keeping each survivor.
  const dependencyTargets=new Set<string>();let linksRemoved=0;
  for(const identifier of detachedComplete){
    let child=await json('/issues/'+identifier);
    if(child.parent&&remainingComplete.has(child.parent.identifier)){
      child=await json('/issues/'+identifier+'/parent','PATCH',{expectedVersion:child.version,parentIdentifier:null});linksRemoved++;
    }
    for(const dependency of child.dependencies.filter((row:any)=>row.direction==='blocked-by'&&remainingComplete.has(row.identifier))){
      child=await json('/issues/'+identifier);const related=await json('/issues/'+dependency.identifier);
      await json('/issues/'+identifier+'/dependencies','DELETE',{expectedVersion:child.version,relatedIdentifier:related.identifier,relatedVersion:related.version,direction:'blocked-by'});
      dependencyTargets.add(related.identifier);linksRemoved++;
    }
    child=await json('/issues/'+identifier);
    if(child.canonical&&remainingComplete.has(child.canonical.identifier)){
      await json('/issues/'+identifier+'/duplicate','POST',{expectedVersion:child.version,canonicalIdentifier:null});linksRemoved++;
    }
  }
  expect(linksRemoved).toBeGreaterThan(0);
  // Dependency removal records native history on both endpoints. That history
  // must still block rollback until the owner explicitly deletes the endpoint.
  const afterUnlink=await json('/data/import/runs/'+complete.id+'/rollback');
  expect(afterUnlink.conflicts.map((row:any)=>row.identifier).sort()).toEqual([...dependencyTargets].sort());
  expect(dependencyTargets.size).toBeGreaterThan(0);
  for(const conflict of afterUnlink.conflicts){expect(conflict.reasons).toContain('linked');expect(conflict.reasons).not.toContain('erasure_detached');}
  const unlinkRefusal=await json('/data/import/runs/'+complete.id+'/rollback','POST',{confirmed:true},409);
  expect(unlinkRefusal.conflicts).toEqual(afterUnlink.conflicts);
  for(const identifier of dependencyTargets){
    const target=await json('/issues/'+identifier);
    await json('/issues/'+identifier,'DELETE',{expectedVersion:target.version,confirmed:true});
  }
  const resolved=await json('/data/import/runs/'+complete.id+'/rollback');expect(resolved.conflicts).toEqual([]);
  let resolvedRun=await json('/data/import/runs/'+complete.id+'/rollback','POST',{confirmed:true});
  while(resolvedRun.progress.unfinished)resolvedRun=await json('/data/import/runs/'+complete.id+'/resume','POST',{});
  expect(resolvedRun.state).toBe('rolled_back');expect(resolvedRun.progress.detachedIdentifiers).toEqual(detachedComplete);
  expect(await survivingIdentifiers(beforeComplete)).toEqual(detachedComplete);
  const survivor=await json('/issues/'+detachedPending[0]);
  await json('/issues/'+survivor.identifier,'DELETE',{expectedVersion:survivor.version,confirmed:true});
  const survivors=detachedPending.filter(identifier=>identifier!==survivor.identifier);
  expect((await json('/data/import/runs/'+rollbackPending.id)).progress.detachedIdentifiers).toEqual(survivors);
  const updatedList=await json('/data/import/runs');expect(updatedList.runs.find((row:any)=>row.id===rollbackPending.id).detachedIdentifiers).toEqual(survivors);
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  console.info('erasure-rollback-proof',JSON.stringify({r1:{created:beforeComplete.length,retained:detachedComplete,conflicts:blocked.conflicts,refusal:refusedRollback.message,resolvedState:resolvedRun.state},r6:{created:beforeRollbackPending.length,state:rolled.state,progress:rolled.progress},reusedDetached:0}));

  // An operator is erased only after removal (OPS-004) has transferred their work
  // and replaced their email and name on the operator and sign-in rows.
  const maya = { email: 'maya@base.test', names: ['Maya Chen'] };
  expect((await f.call('/data/erasure/preview', 'POST', maya)).status).toBe(409);
  expect((await f.call('/settings/operators/' + f.maya, 'DELETE')).status).toBe(200);
  const mayaPreview = await (await f.call('/data/erasure/preview', 'POST', maya)).json() as { imported: { comments: number }; confirmation: string };
  expect(mayaPreview.imported.comments).toBeGreaterThan(0);
  const beforeMayaJournal=await journalIds();
  const mayaErased = await f.call('/data/erasure', 'POST', { subject: maya, confirmation: mayaPreview.confirmation });
  expect(mayaErased.status, await mayaErased.clone().text()).toBe(200);
  const mayaReceipt=await mayaErased.json() as {journal:{receiptId:string;recordsErased:number}};
  expect(mayaReceipt.journal.recordsErased).toBeGreaterThan(0);
  const afterMayaJournal=await journalIds();
  expect(afterMayaJournal).toEqual([...beforeMayaJournal,mayaReceipt.journal.receiptId].sort());
  expect(afterMayaJournal).toContain(first.journal.receiptId);

  // The pending run finishes without the erased records; issues already written stay.
  while (pending.progress.unfinished) pending = await f.resume(pending);
  expect(pending.state).toBe('completed');
  expect(await count("SELECT count(*) AS n FROM issues WHERE id IN (SELECT target_id FROM ik_provenance WHERE target_kind='issue')")).toBeGreaterThan(0);
  expect(await count('SELECT count(*) AS n FROM issue_comments WHERE imported_author_name=?', 'Erased person')).toBeGreaterThan(0);
  expect(await journalIds()).toEqual(afterMayaJournal);
  const after = await holders(env.DB, NEEDLES, env.FILES);
  console.info('person-erasure-proof', JSON.stringify({ holdersBefore: before, holdersAfter: after, recordsErased: first.journal.recordsErased }));
  expect(after).toEqual({});
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);

  // An archive made before the erasure is refused when a later journal is supplied.
  const later = await httpExport(f.call), manifest = later[0];
  if (manifest.kind !== 'manifest') throw Error('Archive manifest missing');
  const cookie = await freshTarget(), staged = await stageArchive(older, cookie);
  const refused = await targetCall('/api/portability/imports/' + staged + '/finalize', 'POST', { ...finalBody(older), laterJournal: { sourceIdentity: manifest.sourceIdentity, epoch: manifest.epoch, journal: manifest.journal } }, cookie);
  expect(refused.status, await refused.clone().text()).toBe(400);
  expect(await refused.text()).toContain('erasure_epoch');
  expect(await destination.ARCHIVE_TARGET_DB.prepare('SELECT count(*) AS n FROM ik_jobs').first<number>('n')).toBe(0);
  expect((await targetCall('/api/portability/imports/' + staged + '/abort', 'POST', {}, cookie)).status).toBe(200);
  // The archive made after it restores, and holds nothing of either person.
  const restored = await stageArchive(later, cookie);
  const finalized = await targetCall('/api/portability/imports/' + restored + '/finalize', 'POST', finalBody(later), cookie);
  expect(finalized.status, await finalized.clone().text()).toBe(200);
  expect(await holders(destination.ARCHIVE_TARGET_DB, NEEDLES, destination.ARCHIVE_TARGET_FILES)).toEqual({});
}, 600000);
