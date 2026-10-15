import { useEffect, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { ApiError, fetchJson } from '../../../app/api-client'

// The draft survives the round trip through the confirmation link (which may
// open in another tab), so the operator only presses Send invitation again.
const DRAFT = 'vector:invite-draft'
const draftSchema = z.object({ email: z.string(), displayName: z.string(), at: z.number() })
function readDraft() {
  try {
    const parsed = draftSchema.safeParse(JSON.parse(localStorage.getItem(DRAFT) ?? 'null'))
    return parsed.success && Date.now() - parsed.data.at < 30 * 60_000 ? parsed.data : null
  } catch { return null }
}
function saveDraft(draft: { email: string; displayName: string } | null) {
  try { if (draft) localStorage.setItem(DRAFT, JSON.stringify({ ...draft, at: Date.now() })); else localStorage.removeItem(DRAFT) } catch { /* storage is a convenience */ }
}

type StepUp = 'needed' | 'sending' | 'outbox' | 'email'

export function InviteOperator({ disabled, onInvited }: { disabled: boolean; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [stepUp, setStepUp] = useState<StepUp | null>(null)
  useEffect(() => {
    const draft = readDraft()
    if (!draft) return
    setEmail(draft.email); setDisplayName(draft.displayName)
    setMessage('Once you have confirmed it’s you, send the invitation again.')
  }, [])
  async function invite(event: FormEvent) {
    event.preventDefault(); setPending(true); setMessage(''); setFailed(false); setStepUp(null)
    try {
      await fetchJson('/api/settings/operators/invite', z.object({ status: z.literal('accepted') }), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, displayName }),
      })
      setMessage('Invitation submitted for delivery. The operator appears here after accepting it.')
      setEmail(''); setDisplayName(''); saveDraft(null); onInvited()
    } catch (error) {
      if (error instanceof ApiError && (error.body as { error?: unknown } | null)?.error === 'step_up_required') {
        saveDraft({ email, displayName }); setStepUp('needed')
      } else { setFailed(true); setMessage(error instanceof Error ? error.message : 'The invitation could not be sent.') }
    } finally { setPending(false) }
  }
  async function confirmIdentity() {
    setStepUp('sending'); setMessage(''); setFailed(false)
    try {
      const sent = await fetchJson('/api/settings/operators/confirm-identity', z.object({ status: z.literal('accepted'), delivery: z.enum(['outbox', 'email']) }), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      })
      setStepUp(sent.delivery)
    } catch (error) {
      setStepUp('needed'); setFailed(true); setMessage(error instanceof Error ? error.message : 'The confirmation link could not be sent.')
    }
  }
  return <form onSubmit={invite} aria-label="Invite operator">
    <h3>Invite an operator</h3>
    <label htmlFor="invite-name">Name</label>
    <input id="invite-name" required maxLength={120} value={displayName} onChange={event => setDisplayName(event.target.value)} />
    <label htmlFor="invite-email">Email</label>
    <input id="invite-email" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
    <button type="submit" disabled={disabled || pending || stepUp === 'sending'}>{pending ? 'Sending…' : 'Send invitation'}</button>
    {stepUp && <div className="settings-confirm" role="group" aria-label="Confirm it's you">
      {stepUp === 'needed' || stepUp === 'sending' ? <>
        <p role="status">Inviting someone gives them full access to this workspace, so confirm it’s you first. Vector sends a one-use confirmation link to your own email address.</p>
        <button type="button" disabled={stepUp === 'sending'} onClick={confirmIdentity}>{stepUp === 'sending' ? 'Sending…' : 'Send confirmation link'}</button>
      </> : stepUp === 'outbox' ? <p role="status">
        Vector is running on this computer, so nothing is emailed. Open the <a href="/__dev/outbox">development outbox</a>, read the newest message, open its link and press Confirm. You come back here to send the invitation.
      </p> : <p role="status">
        Check your email for the confirmation link, open it in this browser and press Confirm. You come back here to send the invitation. The link works once, for 15 minutes.
      </p>}
    </div>}
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
  </form>
}
