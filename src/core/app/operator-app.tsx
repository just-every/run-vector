import { Outlet } from '@tanstack/react-router'
import { AppShell } from './ui/app-shell'

export function OperatorApp() {
  return (
    <AppShell><Outlet /></AppShell>
  )
}
