import type { ReactNode } from 'react'

/** A keyboard key, drawn as a keycap: ink outline with a heavier bottom edge. Small is the palette's Esc. */
export function Keycap({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return <kbd className={`vx-key${small ? ' vx-key--small' : ''}`}>{children}</kbd>
}
