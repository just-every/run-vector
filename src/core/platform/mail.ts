// Base owns validation and transport; Vector owns configuration and queue timing.
// @ts-expect-error Base mail is native ESM without declarations.
import { createMailSender } from '../../../vendor/base/mail/index.mjs'
import type { WorkerBindings } from '../app/bindings'

export function hostedMailConfigured(env: WorkerBindings) {
  return Boolean(env.MAIL_API_KEY && ['sendgrid', 'resend', 'rer'].includes(env.MAIL_PROVIDER ?? '') &&
    (env.MAIL_PROVIDER !== 'rer' || env.MAIL_RELAY_URL))
}

type Message = { headers?: Record<string, string>; [name: string]: unknown }
export function hostedMailSender(env: WorkerBindings, network: typeof fetch = (url, init) => globalThis.fetch(url, init)) {
  if (!hostedMailConfigured(env)) return undefined
  return { async send(message: Message) {
    let retryAfterSeconds: number | undefined
    const provider = env.MAIL_PROVIDER
    const sender = createMailSender({ provider, mode: 'production', apiKey: env.MAIL_API_KEY,
      ...(provider === 'rer' ? { relayUrl: env.MAIL_RELAY_URL } : {}),
    }, { fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
      // Workerd rejects the standard "error" redirect mode. Implement Base's
      // contract at the host boundary: never follow, and reject any redirect.
      const response = await network(url, provider === 'rer' ? { ...init, redirect: 'manual' } : init)
      if (provider === 'rer' && response.status >= 300 && response.status < 400)
        throw new Error('Mail relay redirects are not allowed')
      const delay = response.headers.get('Retry-After')
      if (response.status === 429 && delay !== null && /^\d+$/.test(delay)) {
        const seconds = Number(delay)
        if (Number.isSafeInteger(seconds) && seconds <= (8.64e15 - Date.now()) / 1000)
          retryAfterSeconds = seconds
      }
      return response
    } })
    // Auth's auto-response hint belongs to direct email transport. The relay
    // accepts only message content and owns provider headers and sender policy.
    if (provider === 'rer' && message.headers?.['Auto-Submitted'] === 'auto-generated') {
      const headers = { ...message.headers }
      delete headers['Auto-Submitted']
      const { headers: _headers, ...content } = message
      message = Object.keys(headers).length ? { ...content, headers } : content
    }
    const result = await sender.send(message)
    return { ...result, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) }
  } }
}
