import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { setupLinearWorkspace } from './linear-workspace-fixture';
import { generateLinearWorkspace } from '../fixtures/import/linear/generate.mjs';
import { destination, finalBody, freshTarget, httpExport, stageArchive, targetCall } from './http-archive-fixture';
import { holders } from './sentinel-scan';
import type { ImportInput } from '../../src/core/features/data/import/types';

const STRANGER = 'Quentin Erasewell', NEEDLES = ['quentin erasewell', 'maya chen', 'maya@base.test'];
const count = async (sql: string, ...params: unknown[]) => (await env.DB.prepare(sql).bind(...params).first<number>('n')) ?? 0;

it('[DATA-009 BASE-DATA-003] an imported person and a removed operator are erased from applied and pending runs and every table; an archive made before is refused on restore', async () => {
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
  const before = await holders(env.DB, NEEDLES, env.FILES);
  for (const table of ['issue_comments', 'vector_import_reports', 'oa_operators', 'ik_d1_plan_chunks', 'ik_d1_original_chunks']) expect(Object.keys(before), table).toContain(table);
  const older = await httpExport(f.call);

  // A stranger who never had an account, by the exact name the files carried.
  const stranger = { names: [STRANGER] };
  const preview = await f.call('/data/erasure/preview', 'POST', stranger);
  expect(preview.status, await preview.clone().text()).toBe(200);
  const shown = await preview.json() as { imported: { comments: number; reports: number }; confirmation: string };
  expect(shown.imported.comments).toBeGreaterThan(0);expect(shown.imported.reports).toBeGreaterThan(0);
  expect((await f.call('/data/erasure', 'POST', { subject: stranger, confirmation: 'erase someone' })).status).toBe(400);
  const strangerErased = await f.call('/data/erasure', 'POST', { subject: stranger, confirmation: shown.confirmation });
  expect(strangerErased.status, await strangerErased.clone().text()).toBe(200);
  const first = await strangerErased.json() as { journal: { recordsErased: number } };
  expect(first.journal.recordsErased).toBeGreaterThan(0);

  // An operator is erased only after removal (OPS-004) has transferred their work
  // and replaced their email and name on the operator and sign-in rows.
  const maya = { email: 'maya@base.test', names: ['Maya Chen'] };
  expect((await f.call('/data/erasure/preview', 'POST', maya)).status).toBe(409);
  expect((await f.call('/settings/operators/' + f.maya, 'DELETE')).status).toBe(200);
  const mayaPreview = await (await f.call('/data/erasure/preview', 'POST', maya)).json() as { imported: { comments: number }; confirmation: string };
  expect(mayaPreview.imported.comments).toBeGreaterThan(0);
  const mayaErased = await f.call('/data/erasure', 'POST', { subject: maya, confirmation: mayaPreview.confirmation });
  expect(mayaErased.status, await mayaErased.clone().text()).toBe(200);
  expect((await mayaErased.json() as { journal: { recordsErased: number } }).journal.recordsErased).toBeGreaterThan(0);

  // The pending run finishes without the erased records; issues already written stay.
  while (pending.progress.unfinished) pending = await f.resume(pending);
  expect(pending.state).toBe('completed');
  expect(await count("SELECT count(*) AS n FROM issues WHERE id IN (SELECT target_id FROM ik_provenance WHERE target_kind='issue')")).toBeGreaterThan(0);
  expect(await count('SELECT count(*) AS n FROM issue_comments WHERE imported_author_name=?', 'Erased person')).toBeGreaterThan(0);
  const journal = await (await f.call('/data/erasure/journal')).json() as { entries: unknown[] };
  expect(journal.entries).toHaveLength(2);
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
