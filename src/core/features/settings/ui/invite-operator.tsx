import { useEffect, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { ApiError, fetchJson } from '../../../app/api-client'
import { GuestTeams } from './guest-teams'
import type { AssignableRole } from '../../roles/matrix'

// The draft survives the round trip through the confirmation link (which may
// open in another tab), so the operator only presses Send invitation again.
const DRAFT = 'vector:invite-draft'
const draftSchema = z.object({ email: z.string(), displayName: z.string(), role: z.enum(['owner', 'admin', 'member','guest']).default('member'), teamIds:z.array(z.string()).default([]), at: z.number() })
function readDraft() {
  try {
    const parsed = draftSchema.safeParse(JSON.parse(localStorage.getItem(DRAFT) ?? 'null'))
    return parsed.success && Date.now() - parsed.data.at < 30 * 60_000 ? parsed.data : null
  } catch { return null }
}
function saveDraft(draft: { email: string; displayName: string; role: AssignableRole; teamIds:string[] } | null) {
  try { if (draft) localStorage.setItem(DRAFT, JSON.stringify({ ...draft, at: Date.now() })); else localStorage.removeItem(DRAFT) } catch { /* storage is a convenience */ }
}

type StepUp = 'needed' | 'sending' | 'email'

const roleNames: Record<AssignableRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member', guest:'Guest' }

/** An invitation names the role it grants (ROLE-001); Member is the default. */
export function InviteOperator({ disabled, delivery, roles, teams, onInvited }: { disabled: boolean; delivery: 'local' | 'email'; roles: AssignableRole[]; teams:{id:string;name:string}[]; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<AssignableRole>('member')
  const [teamIds,setTeamIds] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [stepUp, setStepUp] = useState<StepUp | null>(null)
  useEffect(() => {
    const draft = readDraft()
    if (!draft) return
    setTeamIds(draft.teamIds); setEmail(draft.email); setDisplayName(draft.displayName); if (roles.includes(draft.role)) setRole(draft.role)
    setMessage('Once you have confirmed it’s you, send the invitation again.')
  }, [])
  async function invite(event: FormEvent) {
    event.preventDefault(); setPending(true); setMessage(''); setFailed(false); setStepUp(null)
    try {
      const result = await fetchJson('/api/settings/operators/invite', z.object({ status: z.literal('accepted'), delivery: z.enum(['local', 'email']) }), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, displayName, role, ...(role === 'guest' ? {teamIds} : {}) }),
      })
      setMessage(result.delivery === 'local'
        ? 'Invitation saved locally. No email was sent. Use the teammate steps above to try another member.'
        : `Invitation submitted for delivery. The new ${roleNames[role]} appears here after accepting it.`)
      setEmail(''); setDisplayName(''); setRole('member'); setTeamIds([]); saveDraft(null); onInvited()
    } catch (error) {
      if (error instanceof ApiError && (error.body as { error?: unknown } | null)?.error === 'step_up_required') {
        saveDraft({ email, displayName, role, teamIds }); setStepUp('needed')
      } else { setFailed(true); setMessage(error instanceof Error ? error.message : 'The invitation could not be sent.') }
    } finally { setPending(false) }
  }
  async function confirmIdentity() {
    setStepUp('sending'); setMessage(''); setFailed(false)
    try {
      const sent = await fetchJson('/api/settings/operators/confirm-identity', z.object({ status: z.literal('accepted'), delivery: z.literal('email') }), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      })
      setStepUp(sent.delivery)
    } catch (error) {
      setStepUp('needed'); setFailed(true); setMessage(error instanceof Error ? error.message : 'The confirmation link could not be sent.')
    }
  }
  return <form onSubmit={invite} aria-label="Invite member">
    <h3>Invite a member</h3>
    {delivery === 'local' && <p>No email is sent from this local copy. To try a teammate, open the owner’s <code>RER_OPEN</code> link first, then run <code>rer dev --as teammate</code> and open its link in the same browser. This switches to a separate local Member; it does not accept an invitation for the email below. Deploy Vector to invite someone by email.</p>}
    <label htmlFor="invite-name">Name</label>
    <input id="invite-name" required maxLength={120} value={displayName} onChange={event => setDisplayName(event.target.value)} />
    <label htmlFor="invite-email">Email</label>
    <input id="invite-email" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
    <label htmlFor="invite-role">Role</label>
    <select id="invite-role" value={role} onChange={event => setRole(event.target.value as AssignableRole)}>
      {roles.map(choice => <option key={choice} value={choice}>{roleNames[choice]}</option>)}
    </select>
    {role === 'guest' && <GuestTeams teams={teams} selected={teamIds} onChange={setTeamIds} disabled={disabled || pending} />}
    <button type="submit" disabled={disabled || pending || role === 'guest' && !teamIds.length || stepUp === 'sending'}>{pending ? 'Sending…' : 'Send invitation'}</button>
    {stepUp && <div className="settings-confirm" role="group" aria-label="Confirm it's you">
      {stepUp === 'needed' || stepUp === 'sending' ? <>
        <p role="status">Inviting someone gives them access to this workspace, so confirm it’s you first. Vector sends a one-use confirmation link to your own email address.</p>
        <button type="button" disabled={stepUp === 'sending'} onClick={confirmIdentity}>{stepUp === 'sending' ? 'Sending…' : 'Send confirmation link'}</button>
      </> : <p role="status">
        Check your email for the confirmation link, open it in this browser and press Confirm. You come back here to send the invitation. The link works once, for 15 minutes.
      </p>}
    </div>}
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
  </form>
}
