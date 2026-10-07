import type { loadWorkspaceSnapshot } from './repository'

export type WorkspaceSnapshot = Awaited<ReturnType<typeof loadWorkspaceSnapshot>>
