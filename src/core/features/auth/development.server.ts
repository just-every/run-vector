import type { WorkerBindings } from '../../app/bindings'
// @ts-expect-error Base mail is native ESM.
import { createMailSender } from '../../../../vendor/base/mail/index.mjs'
import { createD1DevelopmentOutbox, createDevelopmentOutboxHandler } from '../../../../vendor/base/mail/src/development/index.mjs'
import { devGate, devNotFound } from '../../../../vendor/base/operator-auth/index.mjs'

export function localMailEnabled(env: WorkerBindings) {
  if (env.MAIL_MODE !== 'local-outbox') return false
  const url = new URL(env.APP_ORIGIN)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.origin !== env.APP_ORIGIN || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    throw new Error('Explicit loopback configuration and SESSION_SECRET are required.')
  return true
}
export function developmentSender(env: WorkerBindings) {
  if (!localMailEnabled(env)) throw new Error('Development mail is disabled.')
  // Product SQL triggers guard capture and erasure atomically around Base storage.
  return createMailSender({ provider: 'development', mode: 'development' }, {
    outbox: createD1DevelopmentOutbox({ db: env.DB }),
  })
}
// The outbox and the key exchange answer only a local runtime that holds RER_DEV_KEY. A tunnel or local
// proxy makes remote requests look local, so the outbox also needs the key gate's cookie (or the rer
// harness's key header).
export async function developmentOutboxResponse(env: WorkerBindings, request: Request) {
  if (env.MAIL_MODE !== 'local-outbox') return null
  let local = false
  try { local = localMailEnabled(env) } catch { return null }
  const gate = devGate({ key: env.RER_DEV_KEY, origin: env.APP_ORIGIN, local })
  if (!gate) return devNotFound()
  if (new URL(request.url).pathname === '/__dev/key') return gate.exchange(request)
  if (!await gate.admits(request)) return devNotFound()
  return createDevelopmentOutboxHandler({ local, origin: env.APP_ORIGIN, outbox: createD1DevelopmentOutbox({ db: env.DB }) })(request)
}
