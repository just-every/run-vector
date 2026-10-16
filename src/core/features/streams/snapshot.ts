import type { loadWorkspaceSnapshot } from './repository'

export type WorkspaceSnapshot = Awaited<ReturnType<typeof loadWorkspaceSnapshot>>

/** One fresh graph shared by the stream and its selected detail in a response. */
export type WorkspaceProjection = { snapshot?: WorkspaceSnapshot }
