import { exerciseVideoPreviews } from "./video-preview-journey";
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import assert from 'node:assert/strict'
import { inject, it } from 'vitest'
import { createServerApp } from '../../src/core/app/server'
import { ensureSampleData } from '../../src/core/features/sample-data/service'
import { vectorSampleIds as ids } from '../../sample-data/vector'
import { testCookie } from './native-fixture'

it('[ISSUE-008][ISSUE-009] named video links load only authorized oEmbed players and comment deletion erases their sources atomically', async () => {
  await applyD1Migrations(env.DB, inject('migrations'))
  await ensureSampleData(env.DB, new Date())
  const app = createServerApp(), origin = 'https://vector.test'
  const cookie = await testCookie(env.DB, ids.sarah)
  const request = (path: string, method = 'GET', body?: unknown) => app.request(origin + '/api' + path, {
    method, headers: { cookie, origin, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, { ...env, APP_ORIGIN: origin })
  const created = await (await request('/issues', 'POST', { title: 'Real comment cascade', teamId: ids.flow })).json() as any
  const path = '/issues/' + created.identifier
  const comment = await (await request(path + '/comments', 'POST', { body: 'Erase my attached evidence link' })).json() as any
  const link = await request(path + '/links', 'POST', { name: 'Personal evidence', url: 'https://vector-link.invalid/private-name', commentId: comment.id })
  assert.equal(link.status, 201)
  const linkId = (await link.json() as any).id
  assert.equal((await request(path + '/comments/' + comment.id, 'DELETE')).status, 200)
  const discussion = await (await request(path + '/discussion')).json() as any
  assert.equal(discussion.comments[0].body, null)
  assert.ok(discussion.comments[0].deletedAt)
  assert.deepEqual(discussion.links, [])
  const stored = await env.DB.prepare('SELECT name,url,deleted_at FROM issue_links WHERE id=?').bind(linkId).first<{ name: string | null; url: string | null; deleted_at: string }>()
  assert.equal(stored!.name, null)
  assert.equal(stored!.url, null)
  assert.ok(stored!.deleted_at)
  assert.equal((await (await request(path)).json() as any).version, 1)
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM audit_records WHERE subject_id=? AND action='link.deleted'").bind(linkId).first<{ n: number }>())!.n, 1)
  assert.equal((await request(path + '/links', 'POST', { name: 'Cannot resurrect', url: 'https://vector-link.invalid/new', commentId: comment.id })).status, 404)
  await exerciseVideoPreviews()
})
