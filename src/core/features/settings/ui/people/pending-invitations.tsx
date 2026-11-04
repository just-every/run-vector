import { roleLabels, type Settings } from './people-access';

/** Pending native grants stay visible until the invitee accepts or the link expires. */
export function PendingInvitations({ data }: { data: Settings }) {
  if (!data.pendingInvitations.length) return null;
  return <section className="pending-invitations" aria-labelledby="pending-invitations-title">
    <h2 id="pending-invitations-title">Pending invitations</h2>
    {data.invitationDelivery === 'local'
      ? <p>Local invitations do not send email. In this browser, sign out, then choose the invited person’s name on the sign-in page to accept their invitation. They will appear in People after signing in.</p>
      : <p>Invitees receive an email with a link to accept their invitation.</p>}
    <ul className="settings-rows" aria-label="Pending invitations">
      {data.pendingInvitations.map(person => <li key={person.email} className="pending-person">
        <span className="row-main"><span className="row-name">{person.name}</span>
          <span className="row-meta">{person.email} · {roleLabels[person.role]} · Awaiting acceptance</span></span>
      </li>)}
    </ul>
  </section>;
}
