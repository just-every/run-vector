import { env } from 'cloudflare:workers';
import { expect, inject } from 'vitest';
import { applyD1Migrations } from 'cloudflare:test';
import { collaborationFixture } from './collaboration-fixture';
import { callPrivate, privateState, observedBucket } from './discussion-projection-fixture';
import { insertHistoricalSample } from './historical-sample-fixture';

export const pngBytes = () => Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), c => c.charCodeAt(0));
export async function uploadPng(identifier: string, cookie: string) {
  return callPrivate(`/issues/${identifier}/files`, cookie, { method: 'POST',
    headers: {'content-type': 'image/png', 'x-file-name': 'synthetic-vector-2401.png'}, body: pngBytes() });
}

export async function attachmentPngUpgrade() {
  const db = env.ARCHIVE_TARGET_DB, migrations = inject('migrations');
  const boundary = migrations.findIndex(row => row.name === '0128_attachment_png_dimensions.sql');
  await applyD1Migrations(db, migrations.slice(0, boundary));
  await insertHistoricalSample(db, new Date('2026-10-01T00:00:00Z'));
  const issue = (await db.prepare('SELECT id FROM issues LIMIT 1').first<{id: string}>())!;
  const actor = await db.prepare('SELECT id FROM operators LIMIT 1').first<string>('id');
  await db.prepare("INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,writer_settled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'ready',1,?,?)")
    .bind('synthetic-vector-2402', issue.id, actor, 'synthetic-vector-2403.png', 'image/png', pngBytes().length, 'synthetic-vector-2404', '2026-10-01', '2026-10-01').run();
  await env.ARCHIVE_TARGET_FILES.put('synthetic-vector-2404', pngBytes());
  const before = await db.prepare('SELECT * FROM issue_files').all();
  await applyD1Migrations(db, migrations.slice(boundary));
  expect((await db.prepare('SELECT * FROM issue_files').all()).results).toEqual(before.results.map(row => ({...row, image_width: null, image_height: null})));
  expect(new Uint8Array(await (await env.ARCHIVE_TARGET_FILES.get('synthetic-vector-2404'))!.arrayBuffer())).toEqual(pngBytes());
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}

export async function attachmentPngJourney() {
  await attachmentPngUpgrade();
  const f = await collaborationFixture(), issue = await f.create(), other = await f.create();
  const path = `/issues/${issue.identifier}`;
  const uploaded = await uploadPng(issue.identifier, f.cookie);
  expect(uploaded.status, await uploaded.clone().text()).toBe(201);
  const file = await uploaded.json() as {id: string};
  const embed = `![synthetic-vector-2405](attachment:${file.id})`;
  let current = await (await f.call(path, 'PATCH', {expectedVersion: issue.version, description: embed})).json() as any;
  expect(current.description).toBe(embed);
  const listing = await (await f.call(path + '/discussion')).json() as any;
  expect(listing.files).toContainEqual(expect.objectContaining({id: file.id, state: 'ready', imageWidth: 1, imageHeight: 1, contentType: 'image/png'}));
  const bytes = await f.call(path + '/files/' + file.id);
  expect(bytes.status).toBe(200);
  expect(new Uint8Array(await bytes.arrayBuffer())).toEqual(pngBytes());
  expect(bytes.headers.get('content-disposition')).toMatch(/^attachment;/);
  expect(bytes.headers.get('x-content-type-options')).toBe('nosniff');
  expect(bytes.headers.get('cache-control')).toBe('private, no-store');
  expect(bytes.headers.get('content-type')).toBe('image/png');
  expect((await f.call(`/issues/${other.identifier}/files/${file.id}`)).status).toBe(404);
  const otherListing = await (await f.call(`/issues/${other.identifier}/discussion`)).json() as any;
  expect(otherListing.files.some((row: any) => row.id === file.id)).toBe(false);
  current = await (await f.call(path, 'PATCH', {expectedVersion: current.version, description: ''})).json() as any;
  const retainedBytes = await f.call(path + '/files/' + file.id);
  expect(retainedBytes.status).toBe(200);
  expect(new Uint8Array(await retainedBytes.arrayBuffer())).toEqual(pngBytes());
  expect((await (await f.call(path + '/discussion')).json() as any).files).toContainEqual(expect.objectContaining({id: file.id, state: 'ready'}));
  const revisions = await (await f.call(path + '/description-history')).json() as any;
  const revision = revisions.revisions.find((row: any) => row.description === embed);
  expect(revision).toBeDefined();
  expect((await f.call(path + '/files/' + file.id, 'DELETE')).status).toBe(200);
  expect((await f.call(path + '/files/' + file.id)).status).toBe(404);
  const restored = await f.call(path + '/description-restore', 'POST', {expectedVersion: current.version, revisionId: revision.id});
  expect(restored.status).toBe(200);
  expect((await restored.json() as any).description).toBe(embed);
  expect((await f.call(path + '/files/' + file.id)).status).toBe(404);
  expect(await env.FILES.get(`issues/${issue.id}/${file.id}`)).toBeNull();

  const team = f.initial.teams[0].id;
  expect((await f.call(`/settings/teams/${team}/privacy`, 'PUT', {isPrivate: true})).status).toBe(200);
  const ownedUpload = await uploadPng(issue.identifier, f.cookie);
  expect(ownedUpload.status).toBe(201);
  const ownedFile = await ownedUpload.json() as {id: string};
  const outsider = observedBucket(), outsiderBefore = await privateState();
  const outsiderRead = await callPrivate(path + '/files/' + ownedFile.id, f.bobCookie, {}, {FILES: outsider.bucket});
  expect(outsiderRead.status).toBe(404);
  expect(outsiderRead.headers.get('cache-control')).toContain('no-store');
  expect(outsiderRead.headers.get('content-disposition')).toBeNull();
  expect(await outsiderRead.json()).toEqual({error: 'not_found', message: 'Issue is unavailable.'});
  expect(await privateState()).toEqual(outsiderBefore);
  expect(outsider.calls).toEqual({get: 0, put: 0, delete: 0});
  expect((await uploadPng(issue.identifier, f.bobCookie)).status).toBe(404);
  expect((await f.any(f.bobCookie, path + '/discussion')).status).toBe(404);
  expect((await f.call(`/settings/teams/${team}/members/${f.bob}`, 'PUT', {role: 'member'})).status).toBe(200);
  const privateUpload = await uploadPng(issue.identifier, f.bobCookie);
  expect(privateUpload.status).toBe(201);
  const privateFile = await privateUpload.json() as {id: string};
  const admittedRead = await f.any(f.bobCookie, path + '/files/' + privateFile.id);
  expect(admittedRead.status).toBe(200);
  expect(new Uint8Array(await admittedRead.arrayBuffer())).toEqual(pngBytes());
  expect((await f.call(`/settings/teams/${team}/members/${f.bob}`, 'DELETE')).status).toBe(200);
  const observed = observedBucket(), before = await privateState();
  for (const tail of ['/discussion', '/files/' + privateFile.id])
    expect((await callPrivate(path + tail, f.bobCookie, {}, {FILES: observed.bucket})).status).toBe(404);
  expect(await privateState()).toEqual(before);
  expect(observed.calls).toEqual({get: 0, put: 0, delete: 0});

  expect((await f.call(`/settings/operators/${f.bob}/role`, 'PATCH', {role: 'guest', teamIds: [team]})).status).toBe(200);
  const guestUpload = await uploadPng(issue.identifier, f.bobCookie);
  expect(guestUpload.status).toBe(201);
  const guestFile = await guestUpload.json() as {id: string};
  const guestRead = await f.any(f.bobCookie, path + '/files/' + guestFile.id);
  expect(guestRead.status).toBe(200);
  expect(new Uint8Array(await guestRead.arrayBuffer())).toEqual(pngBytes());
  const outsideTeam = (await f.mutate('/settings/teams', 'POST', {name: 'synthetic-vector-2406', identifierPrefix: 'PNGOUT'})).teams.find(t => t.identifierPrefix === 'PNGOUT')!;
  const outside = await f.create({teamId: outsideTeam.id});
  const outsideUpload = await uploadPng(outside.identifier, f.cookie);
  expect(outsideUpload.status).toBe(201);
  const outsideFile = await outsideUpload.json() as {id: string};
  const guestDenied = observedBucket(), guestBefore = await privateState();
  for (const tail of ['/discussion', '/files/' + outsideFile.id])
    expect((await callPrivate(`/issues/${outside.identifier}` + tail, f.bobCookie, {}, {FILES: guestDenied.bucket})).status).toBe(404);
  expect((await uploadPng(outside.identifier, f.bobCookie)).status).toBe(404);
  expect(await privateState()).toEqual(guestBefore);
  expect(guestDenied.calls).toEqual({get: 0, put: 0, delete: 0});
  expect((await f.call(`/settings/operators/${f.cara}/role`, 'PATCH', {role: 'viewer'})).status).toBe(200);
  const viewerRead = await f.any(f.caraCookie, `/issues/${outside.identifier}/files/${outsideFile.id}`);
  expect(viewerRead.status).toBe(200);
  expect(new Uint8Array(await viewerRead.arrayBuffer())).toEqual(pngBytes());
  const unchanged = await privateState(), objects = (await env.FILES.list()).objects;
  const refused = observedBucket();
  for (const [type, body] of [['image/svg+xml', '<svg/>'], ['image/png', 'synthetic-vector-2407']] as const) {
    expect((await callPrivate(`/issues/${outside.identifier}/files`, f.cookie, {method: 'POST', headers: {'content-type': type, 'x-file-name': 'synthetic-vector-2408'}, body}, {FILES: refused.bucket})).status).toBe(400);
  }
  expect((await callPrivate(`/issues/${outside.identifier}/files`, f.caraCookie, {method: 'POST',
    headers: {'content-type': 'image/png', 'x-file-name': 'synthetic-vector-2409.png'}, body: pngBytes()}, {FILES: refused.bucket})).status).toBe(403);
  expect((await f.any(f.caraCookie, `/issues/${outside.identifier}`, 'PATCH', {expectedVersion: outside.version, description: embed})).status).toBe(403);
  expect(await privateState()).toEqual(unchanged);
  expect((await env.FILES.list()).objects).toEqual(objects);
  expect(refused.calls).toEqual({get: 0, put: 0, delete: 0});
}
