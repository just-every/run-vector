import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate, useRouteContext } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { productConfig } from '../config'
import { CommandPalette } from '../../features/search/ui/command-palette'
import {
  globalShortcut,
  isEditableTarget,
} from '../../features/search/ui/command-helpers'
import { VectorMark } from './vector-mark'

type AppShellProps = { children: ReactNode }
type NavigationItem = {
  to: '/app' | '/app/my-work' | '/app/projects' | '/app/issues'
  label: string
  icon: string
}

const navigation: NavigationItem[] = [
  { to: '/app', label: 'Current', icon: '◈' },
  { to: '/app/my-work', label: 'My work', icon: '◒' },
  { to: '/app/projects', label: 'Projects', icon: '◇' },
  { to: '/app/issues', label: 'Issues', icon: '▤' },
]

export function AppShell({ children }: AppShellProps) {
  const { operator } = useRouteContext({ from: '/app' })
  const location = useLocation()
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteTrigger = useRef<HTMLElement | null>(null)
  const awaitingGo = useRef(false)
  const goTimer = useRef<number | null>(null)
  const openPalette = (trigger?: HTMLElement | null) => {
    paletteTrigger.current =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null)
    setPaletteOpen(true)
  }
  const dismissPalette = () => {
    setPaletteOpen(false)
    window.setTimeout(() => paletteTrigger.current?.focus(), 0)
  }

  useEffect(() => {
    const clearGo = () => {
      awaitingGo.current = false
      if (goTimer.current !== null) window.clearTimeout(goTimer.current)
      goTimer.current = null
    }
    const beginGo = () => {
      clearGo()
      awaitingGo.current = true
      goTimer.current = window.setTimeout(clearGo, 900)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (paletteOpen && event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        dismissPalette()
        return
      }
      if (paletteOpen) return
      const action = globalShortcut({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        editable: isEditableTarget(
          event.target instanceof HTMLElement ? event.target : null,
        ),
        awaitingGo: awaitingGo.current,
      })
      if (!action) {
        clearGo()
        return
      }
      if (action === 'await-go') {
        beginGo()
        return
      }
      clearGo()
      event.preventDefault()
      if (action === 'open-palette') openPalette()
      if (action === 'new-issue') navigate({ to: '/app/new-issue' })
      if (action === 'go-current') navigate({ to: '/app' })
      if (action === 'go-my-work') navigate({ to: '/app/my-work' })
      if (action === 'go-projects') navigate({ to: '/app/projects' })
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      clearGo()
    }
  }, [navigate, paletteOpen])

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link
          className="app-brand"
          to="/app"
          aria-label={`${productConfig.productName} Current`}
        >
          <VectorMark label={productConfig.productName} />
        </Link>
        <nav className="app-nav" aria-label="Workspace">
          {navigation.map((item) => (
            <NavLink key={item.to} item={item} pathname={location.pathname} />
          ))}
        </nav>
        <div className="app-nav-actions">
          <Link className="app-nav-link" to="/app/settings"><span aria-hidden="true">⚙</span><span>Settings</span></Link>
          <button
            type="button"
            className="app-search-trigger"
            aria-haspopup="dialog"
            aria-expanded={paletteOpen}
            onClick={(event) => openPalette(event.currentTarget)}
          >
            <span aria-hidden="true">⌕</span>
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <Link className="app-new-issue-link" to="/app/new-issue">
            ＋ New issue
          </Link>
        </div>
        <div className="app-sidebar-foot">
          <span className="app-avatar" aria-hidden="true">
            {operator.name.split(' ').map(part => part[0]).join('').slice(0,2)}
          </span>
          <span>{operator.name}</span><button type="button" onClick={async () => { const response = await fetch('/auth/signout', { method: 'POST' }); if(response.ok) window.location.assign('/signin') }}>Sign out</button>
        </div>
      </aside>
      <div className="app-stage"><Link className="app-settings-mobile" to="/app/settings">Settings</Link>{children}</div>
      <nav className="app-mobile-nav" aria-label="Workspace">
        {navigation.map((item) => (
          <NavLink key={item.to} item={item} pathname={location.pathname} />
        ))}
        <button
          type="button"
          className="app-nav-link"
          aria-haspopup="dialog"
          aria-expanded={paletteOpen}
          onClick={(event) => openPalette(event.currentTarget)}
        >
          <span aria-hidden="true">⌕</span>
          <span>Search</span>
        </button>
        <Link
          className={`app-nav-link${location.pathname.startsWith('/app/new-issue') ? ' is-active' : ''}`}
          to="/app/new-issue"
        >
          <span aria-hidden="true">＋</span>
          <span>New issue</span>
        </Link>
      </nav>
      {paletteOpen ? <CommandPalette onDismiss={dismissPalette} /> : null}
    </div>
  )
}

function NavLink({
  item,
  pathname,
}: {
  item: NavigationItem
  pathname: string
}) {
  const active =
    item.to === '/app'
      ? pathname === '/app' ||
        pathname.startsWith('/app/current')
      : pathname.startsWith(item.to)
  return (
    <Link
      className={`app-nav-link${active ? ' is-active' : ''}`}
      to={item.to}
      aria-current={active ? 'page' : undefined}
    >
      <span aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  )
}
