import { execFileSync } from 'node:child_process'
const email = process.argv[2]
if (!email || !/^[a-z0-9._+\-]+@vector\.test$/i.test(email))
  throw new Error(
    'Use a synthetic allow-listed @vector.test email, e.g. sarah@vector.test.',
  )
const base = 'http://127.0.0.1:15920'
await fetch(base + '/health')
const response = await fetch(base + '/auth/request', {
  method: 'POST',
  headers: { Origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, returnTo: '/app' }),
})
if (response.status !== 202)
  throw new Error(
    `Sign-in request failed (${response.status}): ${await response.text()}`,
  )
const output = execFileSync(
  'pnpm',
  [
    'exec',
    'wrangler',
    'd1',
    'execute',
    'vector-local',
    '--local',
    '--config',
    'wrangler.jsonc',
    '--persist-to',
    '.wrangler/vector-review',
    '--command',
    `SELECT sign_in_url FROM local_mail_outbox WHERE recipient='${email}' ORDER BY created_at DESC LIMIT 1`,
    '--json',
  ],
  { encoding: 'utf8' },
)
const mail = JSON.parse(output)[0].results[0]
if (!mail)
  throw new Error(
    'No sign-in mail exists for that allow-listed synthetic operator.',
  )
console.log(
  'Open this local single-use sign-in link within 15 minutes:\n' +
    mail.sign_in_url,
)
