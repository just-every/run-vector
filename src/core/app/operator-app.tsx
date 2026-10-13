import { OwnerEditorShell } from '../editor/owner-editor';
import { Outlet, useRouteContext } from '@tanstack/react-router'
import { AppShell } from './ui/app-shell'

export function OperatorApp() {
  const { operator } = useRouteContext({ from: '/app' })
  return (
    <AppShell>{operator.editorConfigured && <OwnerEditorShell/>}<Outlet /></AppShell>
  )
}
