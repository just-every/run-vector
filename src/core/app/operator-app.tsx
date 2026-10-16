import { OwnerEditorShell } from '../editor/owner-editor';
import { Outlet, useRouteContext } from '@tanstack/react-router'
import { AppShell } from './ui/app-shell'
import { InitialResourceProvider } from './initial-resources'

export function OperatorApp() {
  const { operator } = useRouteContext({ from: '/app' })
  return (
    <InitialResourceProvider values={operator.resources}><AppShell>{operator.editorConfigured && <OwnerEditorShell/>}<Outlet /></AppShell></InitialResourceProvider>
  )
}
