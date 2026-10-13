// Small line icons for the drawn product cards and the page, in ink. Decorative: the words beside them carry the meaning.

const common = { 'aria-hidden': true, focusable: false, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function IssueIcon() {
  return (
    <svg className="vx-icon" viewBox="0 0 20 20" {...common}>
      <path d="M5 2.5h6.5L15.5 6.5v11h-10.5z" />
      <path d="M11.5 2.5v4h4M8 10h5M8 13h5" />
    </svg>
  )
}

export function MailIcon() {
  return (
    <svg className="vx-icon" viewBox="0 0 20 20" {...common}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.6" />
      <path d="m3 5.5 7 5.5 7-5.5" />
    </svg>
  )
}

export function SectionIcon() {
  return (
    <svg className="vx-icon" viewBox="0 0 20 20" {...common}>
      <path d="M3.5 5.5h1M7.5 5.5h9M3.5 10h1M7.5 10h9M3.5 14.5h1M7.5 14.5h9" />
    </svg>
  )
}

export function PersonIcon() {
  return (
    <svg className="vx-icon" viewBox="0 0 20 20" {...common}>
      <circle cx="10" cy="6.8" r="3.3" />
      <path d="M3.8 17c.7-3.3 3.1-5.2 6.2-5.2s5.5 1.9 6.2 5.2" />
    </svg>
  )
}

export function FolderIcon() {
  return (
    <svg className="vx-icon" viewBox="0 0 20 20" {...common}>
      <path d="M2.8 5.2c0-.8.6-1.4 1.4-1.4h3.6l1.8 2h6.2c.8 0 1.4.6 1.4 1.4v7.6c0 .8-.6 1.4-1.4 1.4H4.2c-.8 0-1.4-.6-1.4-1.4z" />
    </svg>
  )
}

export function HistoryIcon() {
  return (
    <svg className="vx-icon" viewBox="0 0 20 20" {...common}>
      <path d="M3.4 10a6.6 6.6 0 1 0 1.9-4.7" />
      <path d="M3 2.8v3.4h3.4M10 6.4V10l2.6 1.8" />
    </svg>
  )
}

export function TerminalIcon() {
  return (
    <svg className="vx-icon" viewBox="0 0 20 20" {...common}>
      <path d="m4 5.8 4.4 4.2L4 14.2M10.5 15h5.5" />
    </svg>
  )
}

/** A filled cobalt check: something that has been done and saved. */
export function SavedIcon() {
  return (
    <svg className="vx-icon vx-icon--saved" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.5" fill="var(--vx-cobalt)" />
      <path d="m6.2 10.2 2.6 2.6 5-5.4" fill="none" stroke="var(--vx-on-cobalt)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** The cobalt arrow that carries work from one card to the next. */
export function FlowArrow({ className = 'vx-arrow' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 56 24" preserveAspectRatio="xMaxYMid meet" aria-hidden="true" focusable="false">
      <path d="M3 12h36" stroke="var(--vx-cobalt)" strokeWidth="7" strokeLinecap="round" />
      <path d="M35 3 53 12 35 21z" fill="var(--vx-cobalt)" stroke="var(--vx-cobalt)" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

// The Free section's proof row: a seat, a plan and a price tag, each struck through once. Page chrome, so ink only.
const proof = { 'aria-hidden': true, focusable: false, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function NoSeatsIcon() {
  return (
    <svg className="vx-proof-icon" viewBox="0 0 32 32" {...proof}>
      <circle cx="13" cy="10" r="4.6" />
      <path d="M4.5 26c.9-5 4.2-7.8 8.5-7.8 2.5 0 4.6.9 6.1 2.6M25 6 6 27" />
    </svg>
  )
}

export function NoPlansIcon() {
  return (
    <svg className="vx-proof-icon" viewBox="0 0 32 32" {...proof}>
      <path d="m16 5 11 5.5-11 5.5L5 10.5zM5 16l11 5.5L27 16M5 21.5 16 27l11-5.5M26 4 6 28" />
    </svg>
  )
}

export function NoFeesIcon() {
  return (
    <svg className="vx-proof-icon" viewBox="0 0 32 32" {...proof}>
      <path d="M17.5 4.5H27v9.5L15 26a2 2 0 0 1-2.8 0L6 19.8A2 2 0 0 1 6 17z" />
      <circle cx="22" cy="9.6" r="1.6" />
      <path d="M27.5 27 5 4.5" />
    </svg>
  )
}
