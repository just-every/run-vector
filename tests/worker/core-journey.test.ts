import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import assert from 'node:assert/strict'
import { beforeAll, inject, it } from 'vitest'
import { createServerApp } from '../../src/core/app/server'
import { ensureSampleData } from '../../src/core/features/sample-data/service'
import { vectorSampleIds as ids } from '../../sample-data/vector'
import { testCookie } from './native-fixture'
import { safeReturnTo } from '../../src/core/features/auth/service'
const app = createServerApp(),
  origin = 'https://127.0.0.1:15920'
const bindings = { ...env, APP_ORIGIN: origin, MAIL_MODE: 'local-outbox' }
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject('migrations'))
  await ensureSampleData(env.DB, new Date())
})
function raw(path: string, init?: RequestInit) {
  return app.request(origin + path, {...init,headers:{host:new URL(origin).host,...Object.fromEntries(new Headers(init?.headers))}}, bindings)
}
async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie?: string,
) {
  return raw(path, {
    method,
    headers: {
      cookie: cookie ?? (await testCookie(env.DB, ids.sarah)),
      origin,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
it('[BASE-ACCESS-002] known and unknown protected Hono routes deny missing, expired and revoked sessions and permit a valid control', async () => {
  for (const cookie of [
    '',
    await testCookie(
      env.DB,
      ids.sarah,
      new Date(Date.now() - 1000).toISOString(),
    ),
    await testCookie(env.DB, ids.sarah, undefined, new Date().toISOString()),
  ]) {
    for (const path of ['/api/session', '/api/current', '/api/unknown']) {
      const r = await raw(path, { headers: { cookie } })
      assert.equal(r.status, 401)
      assert.ok(!(await r.text()).includes('FLW-842'))
    }
    assert.equal(
      (
        await raw('/api/issues', {
          method: 'POST',
          headers: { cookie, origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Forbidden', teamId: ids.flow }),
        })
      ).status,
      401,
    )
  }
  assert.equal((await request('/api/session')).status, 200)
  assert.equal((await request('/api/unknown')).status, 404)
})
it('[BASE-ACCESS-001][BASE-ACCESS-004] signs in only an allow-listed operator with one single-use expiring native link', async () => {
  const before = await env.DB.prepare(
    'SELECT COUNT(*) n FROM rer_mail_development_outbox',
  ).first<{ n: number }>()
  const unknown = await raw('/auth/request', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.test' }),
  })
  assert.equal(unknown.status, 202)
  assert.equal(
    (
      await env.DB.prepare('SELECT COUNT(*) n FROM rer_mail_development_outbox').first<{
        n: number
      }>()
    )?.n,
    before?.n,
  )
  const operator = await env.DB.prepare(
    'SELECT email FROM operators WHERE id=?',
  )
    .bind(ids.sarah)
    .first<{ email: string }>()
  const response = await raw('/auth/request', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: operator!.email, returnTo: '//evil.test' }),
  })
  assert.equal(response.status, 202)
  assert.ok(!(await response.text()).includes('token='))
  const mail = await env.DB.prepare(
    "SELECT json_extract(message,'$.text') AS text FROM rer_mail_development_outbox ORDER BY created_at DESC,sequence DESC LIMIT 1",
  ).first<{ text: string }>()
  const url=mail!.text.match(/https?:\/\/[^\s]+/)![0]
  const landing=await raw(new URL(url).pathname+new URL(url).search)
  assert.equal(landing.status,200)
  assert.equal(landing.headers.get('set-cookie'),null)
  const callback = await raw(
    '/auth/confirm', {method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({token:new URL(url).searchParams.get('token')})},
  )
  assert.equal(callback.status, 303)
  assert.equal(callback.headers.get('location'), '/setup')
  const setCookie = callback.headers.get('set-cookie')!
  assert.match(setCookie, /HttpOnly/)
  assert.match(setCookie, /SameSite=Lax/)
  assert.match(setCookie, /Secure/)
  const setup=await request('/api/setup/complete','POST',{confirmed:true},setCookie.split(';')[0])
  assert.equal(setup.status,200)
  assert.deepEqual(await setup.json(),{completed:true})
  assert.equal(
    (
      await raw('/api/session', {
        headers: { cookie: setCookie.split(';')[0] },
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await raw(
        new URL(url).pathname + new URL(url).search,
      )
    ).status,
    400,
  )
  assert.equal(
    (
      await raw('/auth/signout', {
        method: 'POST',
        headers: { origin, cookie: setCookie.split(';')[0], 'Content-Type':'application/json' },
        body: JSON.stringify({}),
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await raw('/api/session', {
        headers: { cookie: setCookie.split(';')[0] },
      })
    ).status,
    401,
  )
  const token = (await import('../../vendor/base/operator-auth/crypto.mjs')).opaqueToken(), now=Date.now()
  const {hashToken}=await import('../../vendor/base/operator-auth/crypto.mjs')
  await env.DB.prepare("INSERT INTO oa_tokens(id,operator_id,operator_version,kind,token_hash,return_to,expires_at,created_at) VALUES(?,?,1,'magic',?,?,?,?)")
    .bind('expired-link',ids.sarah,await hashToken(bindings.SESSION_SECRET,'link',token),'/app',now-1000,now).run()
  assert.equal((await raw('/auth/confirm?token='+token)).status,400)
  assert.equal(safeReturnTo('/app\\evil'), '/app')
  assert.equal(safeReturnTo('/app/my-work'), '/app/my-work')
})
it('[BASE-ACCESS-004] ignores spoofed operator headers and rejects hostile mutation Origins', async () => {
  assert.equal(
    (
      await raw('/api/current', {
        headers: { 'x-vector-operator-id': ids.sarah },
      })
    ).status,
    401,
  )
  const cookie = await testCookie(env.DB, ids.sarah)
  const identity = await raw('/api/session', {
    headers: { cookie, 'x-vector-operator-id': ids.maya },
  })
  assert.deepEqual(await identity.json(), { operatorId: ids.sarah })
  assert.equal(
    (
      await raw('/api/issues', {
        method: 'POST',
        headers: {
          cookie,
          origin: 'https://evil.test',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Cross-origin', teamId: ids.flow }),
      })
    ).status,
    403,
  )
})
it('[ISSUE-004][ISSUE-005][ISSUE-006][ISSUE-007] atomically version-checks concurrent edits with immutable prior values and terminal timestamps', async () => {
  const created = await request('/api/issues', 'POST', {
    title: 'Edit me',
    teamId: ids.flow,
  })
  assert.equal(created.status, 201)
  const issue = (await created.json()) as any
  const results = await Promise.all([
    request('/api/issues/' + issue.identifier, 'PATCH', {
      expectedVersion: 1,
      title: 'First edit',
      assigneeOperatorId: ids.maya,
      statusId: ids.flowCompleted,
    }),
    request('/api/issues/' + issue.identifier, 'PATCH', {
      expectedVersion: 1,
      title: 'Second edit',
    }),
  ])
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409])
  const detail = (await (
    await request('/api/issues/' + issue.identifier)
  ).json()) as any
  assert.equal(detail.version, 2)
  assert.equal(
    detail.activity.filter((a: any) => a.kind === 'issue.updated').length,
    1,
  )
  assert.equal(
    detail.activity.find((a: any) => a.kind === 'issue.updated').previousValue
      .title,
    'Edit me',
  )
  const conflict = (await results.find((r) => r.status === 409)!.json()) as any
  assert.equal(conflict.version, 2)
  assert.equal(conflict.issue.title, detail.title)
  const completed = await request('/api/issues/' + issue.identifier, 'PATCH', {
    expectedVersion: 2,
    statusId: ids.flowCompleted,
  })
  assert.equal(completed.status, 200)
  const terminal = (await completed.json()) as any
  assert.ok(terminal.completedAt)
  const reopened = (await (
    await request('/api/issues/' + issue.identifier, 'PATCH', {
      expectedVersion: terminal.version,
      statusId: ids.flowStarted,
    })
  ).json()) as any
  assert.equal(reopened.completedAt, null)
  assert.equal(
    (
      await request('/api/issues/' + issue.identifier, 'PATCH', {
        expectedVersion: reopened.version,
        statusId: ids.flowIntake,
      })
    ).status,
    409,
  )
  assert.equal(
    (
      await request('/api/issues/' + issue.identifier, 'PATCH', {
        expectedVersion: reopened.version,
        assigneeOperatorId: '01J99999999999999999999999',
      })
    ).status,
    400,
  )
})
it('[ISSUE-008][ISSUE-009][BASE-INPUT-003][BASE-OPS-005] retains comments and tombstones, keeps native private R2 files and erases removed bytes', async () => {
  const created = (await (
    await request('/api/issues', 'POST', {
      title: 'Discuss work',
      teamId: ids.flow,
    })
  ).json()) as any
  const path = '/api/issues/' + created.identifier
  const comment = (await (
    await request(path + '/comments', 'POST', {
      body: '**Evidence** <script>alert(1)</script>',
    })
  ).json()) as any
  assert.ok(comment.id)
  assert.equal(
    (
      await request(path + '/comments/' + comment.id, 'PATCH', {
        body: 'Revised evidence',
      })
    ).status,
    200,
  )
  let discussion = (await (await request(path + '/discussion')).json()) as any
  assert.equal(discussion.comments[0].body, 'Revised evidence')
  assert.ok(discussion.comments[0].editedAt)
  const cookie = await testCookie(env.DB, ids.sarah)
  const uploaded = await raw(path + '/files', {
    method: 'POST',
    headers: {
      cookie,
      origin,
      'Content-Type': 'text/plain',
      'X-File-Name': 'evidence.txt',
    },
    body: 'Durable evidence',
  })
  assert.equal(uploaded.status, 201)
  const file = (await uploaded.json()) as any
  assert.equal((await raw(path + '/files/' + file.id)).status, 401)
  const download = await request(path + '/files/' + file.id)
  assert.equal(download.status, 200)
  assert.equal(await download.text(), 'Durable evidence')
  assert.match(download.headers.get('content-disposition')!, /attachment/)
  assert.equal(
    (
      await raw(path + '/files', {
        method: 'POST',
        headers: {
          cookie,
          origin,
          'Content-Type': 'text/html',
          'X-File-Name': 'bad.html',
        },
        body: '<script>',
      })
    ).status,
    400,
  )
  assert.equal(
    (await request('/api/issues/FLW-842/files/' + file.id)).status,
    404,
  )
  assert.equal(
    (await request(path + '/files/' + file.id, 'DELETE')).status,
    200,
  )
  assert.equal((await request(path + '/files/' + file.id)).status, 404)
  const metadata = await env.DB.prepare(
    'SELECT blob_key FROM issue_files WHERE id=?',
  )
    .bind(file.id)
    .first<{ blob_key: string }>()
  assert.equal(await env.FILES.get(metadata!.blob_key), null)
  assert.equal(
    (await request(path + '/comments/' + comment.id, 'DELETE')).status,
    200,
  )
  discussion = (await (await request(path + '/discussion')).json()) as any
  assert.equal(discussion.comments[0].body, null)
  assert.ok(discussion.comments[0].deletedAt)
  assert.equal(((await (await request(path)).json()) as any).version, 1)
  assert.equal(
    (await env.DB.prepare(
      'SELECT COUNT(*) n FROM audit_records WHERE subject_identifier=?',
    )
      .bind(created.identifier)
      .first<{ n: number }>())!.n,
    3,
  )
})
it('[BASE-ACCESS-003] rejects malformed auth requests and enforces the declared magic-link request limit', async () => {
  assert.equal(
    (
      await raw('/auth/request', {
        method: 'POST',
        headers: { origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-email' }),
      })
    ).status,
    400,
  )
  // Local requests now share an unspoofable loopback bucket. Isolate this limit
  // assertion from earlier sign-in requests; keep the exact five-then-429 guard.
  await env.DB.prepare('DELETE FROM access_rate_limits').run()
  await env.DB.prepare('DELETE FROM oa_limits').run()
  const statuses = []
  for (let n = 0; n < 6; n++)
    statuses.push(
      (
        await raw('/auth/request', {
          method: 'POST',
          headers: {
            origin,
            'Content-Type': 'application/json',
            'cf-connecting-ip': '192.0.2.99',
          },
          body: JSON.stringify({ email: 'nobody@example.test' }),
        })
      ).status,
    )
  assert.deepEqual(statuses, [202, 202, 202, 202, 202, 429])
})
