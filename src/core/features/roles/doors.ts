import type { RowId, SettingsPage } from './matrix'

/** What a door's resolvers may read: route parameters, the parsed JSON body
 * (undefined when absent or malformed; the handler reports that) and SELECTs. */
export type DoorRequest = { db: D1Database; actor: string; path: string; params: Record<string, string>; body: () => Promise<unknown> }
type Resolve<T> = (request: DoorRequest) => Promise<T> | T
/** Every state-changing door is registered against exactly one role-matrix row.
 * A few doors serve several matrix actions; they resolve the one row each
 * request acts under. `null` is a door with no row: only Owners pass (ROLE-008),
 * unless it opens a Settings `page`, which the "Open Settings pages" row decides.
 * `teams` names the teams a request acts on, for team cells and Guests, and
 * `project` the project whose lead a lead cell admits.
 * Read doors are registered only where a row narrows what they show. */
export type Door = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'ALL'
  path: string
  row: RowId | null | Resolve<RowId | null>
  page?: SettingsPage
  teams?: Resolve<string[] | null>
  project?: Resolve<string | null>
  invitation?: true
}

const field = async (request: DoorRequest, name: string) => {
  const body = await request.body()
  return body && typeof body === 'object' ? (body as Record<string, unknown>)[name] : undefined
}
const text = (value: unknown) => typeof value === 'string' ? value : undefined
/** Teams named by id or issue identifier (or every team), kept only inside the actor's workspace. */
async function teamsOf(db: D1Database, actor: string, ids: string[] | 'all', identifiers: string[] = []) {
  if (ids !== 'all' && !ids.length && !identifiers.length) return null
  const rows = (await db.prepare(`SELECT DISTINCT t.id FROM teams t JOIN operators o ON o.workspace_id=t.workspace_id AND o.id=?
    WHERE ? OR t.id IN (SELECT value FROM json_each(?)) OR t.id IN (SELECT i.team_id FROM issues i JOIN json_each(?) j ON i.identifier=j.value)`)
    .bind(actor, Number(ids === 'all'), JSON.stringify(ids === 'all' ? [] : ids), JSON.stringify(identifiers)).all<{ id: string }>()).results
  return rows.length ? rows.map(row => row.id) : null
}
const team = (param: string): Resolve<string[] | null> => ({ db, actor, params }) => teamsOf(db, actor, params[param] ? [params[param]] : [])
const bodyTeam: Resolve<string[] | null> = async request => { const id = text(await field(request, 'teamId')); return teamsOf(request.db, request.actor, id ? [id] : []) }
const issue: Resolve<string[] | null> = ({ db, actor, params }) => teamsOf(db, actor, [], params.identifier ? [params.identifier] : [])
/** The project named by the `id` parameter, kept only inside the actor's workspace. */
const project: Resolve<string | null> = async ({ db, actor, params }) => (await db.prepare(`SELECT p.id FROM projects p
  JOIN operators o ON o.workspace_id=p.workspace_id AND o.id=? WHERE p.id=?`).bind(actor, params.id ?? '').first<{ id: string }>())?.id ?? null
/** A create that asks the Slack bot for a channel acts under the channel row,
 * which admits no one the create row refuses (SLACK-003). */
const channelOr = (row: RowId): Resolve<RowId> => async request => await field(request, 'createSlackChannel') === true ? 'channels.create' : row
/** A move or copy acts on its issue's team and on the destination team. */
const issueAndDestination: Resolve<string[] | null> = async request => {
  const destination = text(await field(request, 'teamId'))
  return teamsOf(request.db, request.actor, destination ? [destination] : [], request.params.identifier ? [request.params.identifier] : [])
}
const selected: Resolve<string[] | null> = async request => {
  const rows = await field(request, 'issues'), destination = text(await field(request, 'teamId'))
  const identifiers = Array.isArray(rows) ? rows.map(row => text((row as { identifier?: unknown })?.identifier)).filter((id): id is string => !!id) : []
  return teamsOf(request.db, request.actor, destination ? [destination] : [], identifiers)
}
const comment: Resolve<string[] | null> = async ({ db, actor, params }) => {
  const row = await db.prepare('SELECT i.identifier FROM issue_comments c JOIN issues i ON i.id=c.issue_id WHERE c.id=?').bind(params.id ?? params.itemId).first<{ identifier: string }>()
  return teamsOf(db, actor, [], row ? [row.identifier] : [])
}
/** Whether the comment is someone else's, in the actor's workspace. A comment
 * the actor cannot reach there keeps its own-comment row for the handler to answer. */
const othersComment = async ({ db, actor, params }: DoorRequest) => Boolean(await db.prepare(`SELECT 1 FROM issue_comments c
  JOIN issues i ON i.id=c.issue_id JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id AND o.id=?
  WHERE c.id=? AND (c.actor_operator_id<>o.id OR c.imported_author_name IS NOT NULL)`).bind(actor, params.id ?? params.itemId).first())
const commentDeletion: Resolve<RowId> = async request => await othersComment(request) ? 'comments.delete-others' : 'comments.delete-own'
/** Only a comment's author edits it or ticks its checklists; anyone else acts under its own row. */
const commentEdit = (own: RowId): Resolve<RowId> => async request => await othersComment(request) ? 'comments.edit-others' : own
const view = ({ db, params }: DoorRequest) => db.prepare('SELECT is_shared AS shared,filters_json AS query FROM saved_views WHERE id=?').bind(params.id).first<{ shared: number; query: string }>()
const viewTeams: Resolve<string[] | null> = async request => {
  const row = await view(request)
  const teamId = row ? text((JSON.parse(row.query) as { team?: unknown }).team) : undefined
  // A view across every team covers every team, so only a Guest in all of them opens it.
  return teamsOf(request.db, request.actor, teamId && teamId !== 'all' ? [teamId] : row ? 'all' : [])
}
const leadership = (role: unknown) => role === 'owner' || role === 'admin'
async function memberRole(db: D1Database, id: string) {
  return (await db.prepare('SELECT role FROM operators WHERE id=? AND removed_at IS NULL').bind(id).first<{ role: string }>())?.role
}

export const doors: Door[] = [
  { method: 'GET', path: '/projects/:id/slack-channel', row: 'channels.bind-project' },
  { method: 'POST', path: '/projects/:id/slack-channel', row: 'channels.bind-project' },
  { method: 'POST', path: '/settings/integrations/channels/allowed', row: 'integrations.manage' },
  { method: 'DELETE', path: '/settings/integrations/channels/allowed/:channelId', row: 'integrations.manage' },
  { method: 'GET', path: '/settings/audit', row: 'audit.read' },
  { method: 'GET', path: '/settings/audit.csv', row: 'audit.read' },
  // Workspace, people and permissions
  { method: 'POST', path: '/settings/operators/invite', invitation: true, row: async request => leadership(await field(request, 'role')) ? 'leaders.manage' : 'members.manage' },
  { method: 'POST', path: '/settings/operators/confirm-identity', invitation: true, row: 'members.manage' },
  { method: 'PATCH', path: '/settings/operators/:operatorId/role', row: async request => leadership(await field(request, 'role')) || leadership(await memberRole(request.db, request.params.operatorId)) ? 'leaders.manage' : 'members.manage' },
  { method: 'DELETE', path: '/settings/operators/:operatorId', row: async ({ db, actor, params }) =>
    params.operatorId === actor ? 'workspace.leave' : leadership(await memberRole(db, params.operatorId)) ? 'leaders.manage' : 'members.manage' },
  { method: 'PATCH', path: '/settings', row: 'workspace.settings' },
  { method: 'GET', path: '/settings/notifications/channel-defaults', row: 'workspace.settings' },
  { method: 'PUT', path: '/settings/notifications/channel-defaults', row: 'workspace.settings' },
  { method: 'GET', path: '/settings/notifications/channels', row: null, page: 'account' },
  { method: 'PUT', path: '/settings/notifications/channels', row: null, page: 'account' },
  { method: 'GET', path: '/settings', row: null, page: 'directory' },
  { method: 'GET', path: '/settings/administration', row: null, page: 'teams' },
  { method: 'POST', path: '/setup/complete', row: null },
  { method: 'POST', path: '/data/restore/operators/:id', row: 'data.restore' },
  { method: 'POST', path: '/data/restore/review-effects', row: 'data.restore' },
  { method: 'GET', path: '/data/restore', row: 'data.restore' },
  // Account: every role opens and changes its own records.
  ...([['PATCH', '/settings/appearance'], ['PATCH', '/settings/personal-time'], ['PATCH', '/settings/notifications'], ['GET', '/settings/appearance'], ['GET', '/settings/personal-time'], ['GET', '/settings/notifications'],
    ['POST', '/notifications/:id/read'], ['POST', '/notifications/read-all'], ['POST', '/notifications/:id/snooze'], ['POST', '/notifications/:id/unsnooze'],
    ['PATCH', '/issues/:identifier/subscription'], ['POST', '/issues/:identifier/reminders'], ['DELETE', '/issues/:identifier/reminders/:id'],
    ['PUT', '/preferences/:surface'], ['DELETE', '/preferences/:surface'], ['PUT', '/workload']] as const)
    .map(([method, path]): Door => ({ method, path, row: null, page: 'account' })),
  { method: 'POST', path: '/settings/notifications/slack/lookup', row: 'identity.personal' },
  { method: 'POST', path: '/settings/notifications/slack/link', row: 'identity.personal' },
  { method: 'DELETE', path: '/settings/notifications/slack/link', row: 'identity.personal' },
  // Teams and workflows
  { method: 'POST', path: '/settings/teams', row: channelOr('teams.create') },
  { method: 'POST', path: '/teams/:teamId/join', row: 'teams.join', teams: team('teamId') },
  { method: 'POST', path: '/teams/:teamId/leave', row: 'teams.join', teams: team('teamId') },
  { method: 'PUT', path: '/settings/teams/:id/members/:operatorId', row: 'teams.members', teams: team('id') },
  { method: 'DELETE', path: '/settings/teams/:id/members/:operatorId', row: 'teams.members', teams: team('id') },
  { method: 'PUT', path: '/settings/teams/:id/permissions', row: 'teams.permissions', teams: team('id') },
  // Archiving is not a team setting: only team owners, Owners and Admins archive (TEAM-003).
  { method: 'PATCH', path: '/settings/teams/:id', row: async request => await field(request, 'archived') !== undefined ? 'teams.archive' : 'teams.settings', teams: team('id') },
  { method: 'PUT', path: '/settings/teams/:id/housekeeping', row: 'teams.settings', teams: team('id') },
  { method: 'GET', path: '/settings/teams/:teamId/email-intake', row: 'teams.settings', teams: team('teamId') },
  { method: 'PUT', path: '/settings/teams/:teamId/email-intake', row: 'teams.settings', teams: team('teamId') },
  { method: 'POST', path: '/settings/teams/:id/housekeeping/preview', row: 'teams.settings', teams: team('id') },
  { method: 'PATCH', path: '/teams/:teamId/subissue-rule', row: 'teams.settings', teams: team('teamId') },
  { method: 'POST', path: '/settings/teams/:id/statuses', row: 'teams.workflow', teams: team('id') },
  { method: 'PUT', path: '/settings/teams/:id/statuses/order', row: 'teams.workflow', teams: team('id') },
  { method: 'PATCH', path: '/settings/teams/:id/statuses/:statusId', row: 'teams.workflow', teams: team('id') },
  { method: 'DELETE', path: '/settings/teams/:id/statuses/:statusId', row: 'teams.workflow', teams: team('id') },
  // Issues
  { method: 'POST', path: '/issues', row: 'issues.write', teams: bodyTeam },
  { method: 'PATCH', path: '/issues/:identifier', row: async request => (await request.body() as { cycleId?: unknown } | undefined)?.cycleId !== undefined ? 'cycles.commit' : 'issues.write', teams: issue },
  ...(['/issues/:identifier/dependencies', '/issues/:identifier/links', '/issues/:identifier/subissues', '/issues/:identifier/duplicate', '/issues/:identifier/description-restore'] as const)
    .map((path): Door => ({ method: 'POST', path, row: 'issues.write', teams: issue })),
  { method: 'DELETE', path: '/issues/:identifier/dependencies', row: 'issues.write', teams: issue },
  { method: 'DELETE', path: '/issues/:identifier/links/:linkId', row: 'issues.write', teams: issue },
  { method: 'PATCH', path: '/issues/:identifier/parent', row: 'issues.write', teams: issue },
  { method: 'PATCH', path: '/issues/:identifier/subissues', row: 'issues.write', teams: issue },
  { method: 'POST', path: '/issues/:identifier/team', row: 'issues.write', teams: issueAndDestination },
  { method: 'POST', path: '/issues/bulk', row: 'issues.write', teams: selected },
  { method: 'POST', path: '/issues/bulk/team', row: 'issues.write', teams: selected },
  { method: 'POST', path: '/issues/bulk/duplicate', row: 'issues.write', teams: selected },
  { method: 'POST', path: '/issues/order', row: 'issues.write', teams: bodyTeam },
  { method: 'POST', path: '/issues/undo', row: 'issues.write' },
  { method: 'POST', path: '/issues/:identifier/comments', row: 'issues.write', teams: issue },
  { method: 'GET', path: '/issues/:identifier/references', row: 'issues.write', teams: issue },
  { method: 'GET', path: '/issues/:identifier/email-intake', row: 'issues.write', teams: issue },
  { method: 'POST', path: '/issues/:identifier/email-replies', row: 'email.reply', teams: issue },
  { method: 'PATCH', path: '/issues/:identifier/comments/:itemId', row: commentEdit('comments.own'), teams: issue },
  { method: 'DELETE', path: '/issues/:identifier/comments/:itemId', row: commentDeletion, teams: issue },
  { method: 'POST', path: '/issues/:identifier/comments/:itemId/resolution', row: 'comments.own', teams: issue },
  { method: 'POST', path: '/issues/:identifier/comments/:itemId/checklist', row: commentEdit('media.write'), teams: issue },
  { method: 'POST', path: '/issues/:identifier/checklist', row: 'media.write', teams: issue },
  { method: 'POST', path: '/issues/:identifier/files', row: 'media.write', teams: issue },
  { method: 'DELETE', path: '/issues/:identifier/files/:itemId', row: 'issues.write', teams: issue },
  { method: 'POST', path: '/issues/:identifier/copy', row: 'issues.copy', teams: issueAndDestination },
  { method: 'DELETE', path: '/issues/:identifier', row: 'issues.delete-permanent', teams: issue },
  { method: 'POST', path: '/settings/labels', row: 'labels.create' },
  { method: 'PATCH', path: '/settings/labels/:id', row: 'labels.manage' },
  { method: 'DELETE', path: '/settings/labels/:id', row: 'labels.manage' },
  // Intake and triage
  { method: 'POST', path: '/intake', row: 'intake.create', teams: bodyTeam },
  ...(['accept', 'defer', 'decline', 'return'] as const).map((action): Door => ({ method: 'POST', path: '/issues/:identifier/' + action, row: 'intake.decide', teams: issue })),
  ...([['POST', '/settings/integrations/sources'], ['POST', '/settings/integrations/sources/:id/rotate'], ['POST', '/settings/integrations/sources/:id/webhook-url'], ['DELETE', '/settings/integrations/sources/:id']] as const)
    .map(([method, path]): Door => ({ method, path, row: 'sources.manage' })),
  // Projects
  { method: 'POST', path: '/settings/projects', row: channelOr('projects.write') },
  { method: 'PATCH', path: '/settings/projects/:id', row: async request => { const body = await request.body() as Record<string, unknown> | undefined; return body && ('lifecycle' in body || 'archived' in body) ? 'projects.status' : 'projects.write' } },
  { method: 'DELETE', path: '/settings/projects/:id', row: 'projects.delete', project },
  { method: 'POST', path: '/settings/projects/:id/milestones', row: 'milestones.write' },
  { method: 'PATCH', path: '/settings/projects/:id/milestones/:milestoneId', row: 'milestones.write' },
  { method: 'PUT', path: '/settings/projects/:id/milestones/order', row: 'milestones.write' },
  { method: 'DELETE', path: '/settings/projects/:id/milestones/:milestoneId', row: 'milestones.write' },
  // Cycles
  { method: 'POST', path: '/settings/cycles', row: 'cycles.manage', teams: bodyTeam },
  { method: 'PUT', path: '/settings/teams/:id/cycle-schedule', row: 'cycles.schedule', teams: team('id') },
  // Saved views
  { method: 'POST', path: '/views', row: async request => await field(request, 'isShared') === true ? 'views.share' : 'views.private' },
  { method: 'PATCH', path: '/views/:id', row: async request => (await view(request))?.shared ? 'views.edit-shared' : await field(request, 'isShared') === true ? 'views.share' : 'views.private' },
  { method: 'DELETE', path: '/views/:id', row: async request => (await view(request))?.shared ? 'views.edit-shared' : 'views.private' },
  { method: 'POST', path: '/views/:id/duplicate', row: async request => (await view(request))?.shared ? 'views.open-shared' : 'views.private', teams: viewTeams },
  // Integrations and API
  ...([['GET', '/settings/integrations'], ['GET', '/settings/integrations/channels'], ['POST', '/settings/integrations/delivery'], ['POST', '/settings/integrations/destinations'],
    ['POST', '/settings/integrations/destinations/:id/test'], ['POST', '/settings/integrations/destinations/:id/reenter'], ['DELETE', '/settings/integrations/destinations/:id'],
    ['POST', '/settings/integrations/github'], ['POST', '/settings/integrations/github/:id/reenter'], ['DELETE', '/settings/integrations/github/:id'],
    ['POST', '/settings/integrations/deliveries/:id/resolve'], ['POST', '/settings/integrations/slack'], ['DELETE', '/settings/integrations/slack'],
    ['POST', '/settings/integrations/slack/signing-secret'], ['POST', '/settings/integrations/channels'], ['DELETE', '/settings/integrations/channels/:id']] as const)
    .map(([method, path]): Door => ({ method, path, row: 'integrations.manage' })),
  { method: 'GET', path: '/settings/integrations/tokens', row: null, page: 'personal-integrations' },
  { method: 'GET', path: '/settings/integrations/tokens/usage', row: null, page: 'personal-integrations' },
  { method: 'POST', path: '/settings/integrations/tokens', row: 'tokens.personal' },
  { method: 'DELETE', path: '/settings/integrations/tokens/:id', row: 'tokens.personal' },
  // Import, export and portability
  { method: 'ALL', path: '/portability/*', row: ({ path }) => /^\/api\/portability\/imports(?:\/|$)/.test(path) ? 'data.restore' : 'data.export' },
  ...([['GET', '/data/import/options'], ['GET', '/data/import/runs'], ['GET', '/data/import/runs/:id'], ['GET', '/data/import/runs/:id/originals'], ['GET', '/data/import/runs/:id/report'],
    ['GET', '/data/import/runs/:id/report.csv'], ['GET', '/data/import/runs/:id/rollback'], ['POST', '/data/import/preview'], ['POST', '/data/import/apply'],
    ['POST', '/data/import/runs/:id/resume'], ['POST', '/data/import/runs/:id/rollback']] as const)
    .map(([method, path]): Door => ({ method, path, row: 'data.import' })),
  { method: 'GET', path: '/data/erasure/journal', row: 'data.erase-imported' },
  { method: 'POST', path: '/data/erasure/preview', row: 'data.erase-imported' },
  { method: 'POST', path: '/data/erasure', row: 'data.erase-imported' },
]

/** /api/v1: bearer-token doors of the same actions. */
export const apiDoors: Door[] = [
  { method: 'POST', path: '/issues', row: 'issues.write', teams: bodyTeam },
  { method: 'PATCH', path: '/issues/:identifier', row: async request => (await request.body() as { cycleId?: unknown } | undefined)?.cycleId !== undefined ? 'cycles.commit' : 'issues.write', teams: issue },
  { method: 'POST', path: '/issues/:identifier/comments', row: 'issues.write', teams: issue },
  { method: 'POST', path: '/issues/:identifier/description-restore', row: 'issues.write', teams: issue },
  { method: 'POST', path: '/issues/:identifier/checklist', row: 'media.write', teams: issue },
  { method: 'POST', path: '/issues/:identifier/comments/:itemId/checklist', row: commentEdit('media.write'), teams: issue },
  { method: 'POST', path: '/issues/:identifier/copy', row: 'issues.copy', teams: issueAndDestination },
  { method: 'PATCH', path: '/comments/:id', row: commentEdit('comments.own'), teams: comment },
  { method: 'DELETE', path: '/comments/:id', row: commentDeletion, teams: comment },
  { method: 'POST', path: '/projects', row: 'projects.write' },
  { method: 'PATCH', path: '/projects/:id', row: async request => { const body = await request.body() as Record<string, unknown> | undefined; return body && ('lifecycle' in body || 'archived' in body) ? 'projects.status' : 'projects.write' } },
  { method: 'DELETE', path: '/projects/:id', row: 'projects.delete', project },
  { method: 'POST', path: '/projects/:id/milestones', row: 'milestones.write' },
  { method: 'PATCH', path: '/projects/:id/milestones/:milestoneId', row: 'milestones.write' },
  { method: 'PUT', path: '/projects/:id/milestones/order', row: 'milestones.write' },
  { method: 'DELETE', path: '/projects/:id/milestones/:milestoneId', row: 'milestones.write' },
  { method: 'POST', path: '/cycles', row: 'cycles.manage', teams: bodyTeam },
]

/** Terminal commands that write act only through the doors above, under the
 * session they carry; local resource commands run without an operator. */
export const terminalCommands = {
  'pnpm import:issues preview|apply|resume|rollback': '/api/data/import/* (data.import)',
  'rer export': '/api/portability/* (data.export)',
  'rer import (HTTP restore)': '/api/portability/imports/* (data.restore)',
  'rer import --target local, rer reset, rer setup': 'local resources of the checkout, no workspace session',
} as const
