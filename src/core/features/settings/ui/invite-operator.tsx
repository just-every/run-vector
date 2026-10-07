import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { fetchJson } from '../../../app/api-client'

export function InviteOperator({ disabled, onInvited }: { disabled: boolean; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  async function invite(event: FormEvent) {
    event.preventDefault(); setPending(true); setMessage(''); setFailed(false)
    try {
      await fetchJson('/api/settings/operators/invite', z.object({ status: z.literal('accepted') }), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, displayName }),
      })
      setMessage('Invitation submitted for delivery. The operator appears here after accepting it.')
      setEmail(''); setDisplayName(''); onInvited()
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : 'The invitation could not be sent.')
    } finally { setPending(false) }
  }
  return <form onSubmit={invite} aria-label="Invite operator">
    <h3>Invite an operator</h3>
    <label htmlFor="invite-name">Name</label>
    <input id="invite-name" required maxLength={120} value={displayName} onChange={event => setDisplayName(event.target.value)} />
    <label htmlFor="invite-email">Email</label>
    <input id="invite-email" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
    <button type="submit" disabled={disabled || pending}>{pending ? 'Sending…' : 'Send invitation'}</button>
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
  </form>
}
