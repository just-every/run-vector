import { CardHead, Plate } from '../home/drawing/plate'
import { MailIcon, PersonIcon } from '../home/drawing/icons'

/** The sign-in message Vector sends, drawn: its subject, the confirmation it asks for and its one button. It has not been
 * opened yet, so it arrives askew. */
export function SignInDrawing({ productName }: { productName: string }) {
  return (
    <figure className="vx-door-figure" aria-label={`The sign-in message: Your sign-in link for ${productName}`}>
      <Plate askew className="vx-door-plate">
        <div className="vx-card vx-door-card">
          <CardHead icon={<MailIcon />}>Your sign-in link for {productName}</CardHead>
          <p className="vx-card-title">Confirm sign-in to {productName}</p>
          <span className="vx-door-confirm">Confirm</span>
        </div>
      </Plate>
    </figure>
  )
}

/** The first team setup prepared, drawn as the card the app shows it as: its identifier prefix and its name. */
export function TeamDrawing({ team, prefix }: { team: string; prefix: string }) {
  return (
    <figure className="vx-door-figure" aria-label={`The first team: ${team} · ${prefix}`}>
      <Plate askew className="vx-door-plate">
        <div className="vx-card vx-door-card">
          <CardHead icon={<PersonIcon />} mono>{prefix}</CardHead>
          <div className="vx-row-id">
            <span className="vx-dot" aria-hidden="true" />
            <p className="vx-card-title">{team}</p>
          </div>
          <p className="vx-row-meta">First team</p>
        </div>
      </Plate>
    </figure>
  )
}

