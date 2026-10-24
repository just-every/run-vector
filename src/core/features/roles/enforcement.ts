import type { Context } from 'hono'
import { matchedRoutes } from 'hono/route'
import type { AppEnvironment } from '../../app/bindings'
import { readRequestJson } from '../../app/input'
import type { NativeAccessFence } from '../auth/mutation-database'
import { authorityFence, loadAuthority } from './authority'
import { apiDoors, doors, type Door, type DoorRequest } from './doors'
import { decide, decisionInputs, type Decision } from './policy'
import {visibleTeam,requestableTeam} from './visibility-sql'

const surfaces = { api: doors, v1: apiDoors }
const pattern = (path: string) => new RegExp('^' + path.replace(/[.]/g, '\\.').replace(/:([A-Za-z]+)/g, '(?<$1>[^/]+)').replace(/\*$/, '(?<rest>.*)') + '$')
const patterns = new Map([...doors, ...apiDoors].map(door => [door, pattern(door.path)]))

/** The registered door Hono routed this request to, if any, and the request
 * path below the app's mount point. */
function routedDoor(c: Context<AppEnvironment>, surface: keyof typeof surfaces) {
  const method = c.req.method === 'HEAD' ? 'GET' : c.req.method
  for (const route of matchedRoutes(c)) {
    const base = route.basePath === '/' ? '' : route.basePath
    const path = route.path.slice(base.length)
    const door = surfaces[surface].find(door => door.path === path && (door.method === route.method && door.method === method || door.method === 'ALL' && route.method === 'ALL'))
    if (door) return { door, relative: c.req.path.slice(base.length) }
  }
}

/** ROLE-001 enforcement for one admitted request: the door's role-matrix row,
 * decided on the actor's current record. Reads without a registered row stay
 * open (OPS-001); a write door with no row admits Owners only (ROLE-008).
 * Admitted writes carry the decision's inputs as a transaction fence. */
export async function doorAuthority(c: Context<AppEnvironment>, surface: keyof typeof surfaces, actor: string, source: D1Database): Promise<{ denied?: Response; fence?: NativeAccessFence }> {
  const { door, relative } = routedDoor(c, surface) ?? {}
  const read = ['GET', 'HEAD'].includes(c.req.method)
  if (!door && read) return {}
  let body: Promise<unknown> | undefined
  const request: DoorRequest = {
    db: source, actor, path: c.req.path,
    params: door && relative ? { ...patterns.get(door)!.exec(relative)?.groups } : {},
    // Resolvers read a copy; the handler still owns the request body and its errors.
    body: () => body ??= read ? Promise.resolve(undefined) : readRequestJson(c.req.raw.clone() as unknown as Request).catch(() => undefined),
  }
  const { decision, fence } = await decideDoor(door, request)
  if (decision === 'unauthenticated') return { denied: c.json({ error: 'unauthenticated', message: 'Sign in again to continue.' }, 401, { 'Cache-Control': 'no-store' }) }
  if (decision === 'hidden') return { denied: c.json({ error: 'not_found', message: 'The selected record is unavailable.' }, 404, { 'Cache-Control': 'no-store' }) }
  if (decision === 'forbidden') return { denied: c.json({ error: 'forbidden', message: 'Your workspace role does not allow this action.' }, 403, { 'Cache-Control': 'no-store' }) }
  return read ? {} : { fence }
}

/** The same decision for a registered write door reached outside Hono routing,
 * such as a signed Slack action: no stored link or message carries a role. */
export function actionAuthority(source: D1Database, actor: string, method: Door['method'], path: string, params: Record<string, string>, body: unknown) {
  const door = doors.find(door => door.method === method && door.path === path)
  if (!door) throw new Error(`No registered door for ${method} ${path}.`)
  return decideDoor(door, { db: source, actor, path, params, body: () => Promise.resolve(body) })
}

async function decideDoor(door: Door | undefined, request: DoorRequest): Promise<{ decision: Decision | 'unauthenticated'; fence?: NativeAccessFence }> {
  const row = door ? typeof door.row === 'function' ? await door.row(request) : door.row : null
  const teams = door?.teams ? await door.teams(request) : null
  const project = door?.project ? await door.project(request) : undefined
  const question = { row, page: door?.page, teams, project, invitation: door?.invitation, workMutation: door?.workMutation }
  const authority = await loadAuthority(request.db, request.actor, teams ?? [], project ?? undefined)
  if (!authority) return { decision: 'unauthenticated' }
  const decision = decide(authority, question)
  if(decision!=='allow')return {decision}
  // Administrative metadata/membership authority does not grant content reads.
  const metadata=authority.role==='admin' && row?.startsWith('teams.') && row!=='teams.request' && row!=='teams.join'
  const scope=teams?.length && !metadata && row!=='teams.join' ? {
    sql:`NOT EXISTS(SELECT 1 FROM main.teams t JOIN main.operators reader ON reader.id=? WHERE t.id IN(SELECT value FROM json_each(?)) AND NOT (${visibleTeam('reader','t.id')}${row==='teams.request'?` OR ${requestableTeam('reader','t.id')}`:''}))`,
    values:[request.actor,JSON.stringify(teams)],
  }:null
  if(scope&&!await request.db.prepare('SELECT ('+scope.sql+') AS allowed').bind(...scope.values).first<number>('allowed'))return {decision:'hidden'}
  const fence=authorityFence(request.actor,authority,decisionInputs(authority,question))
  return {decision,fence:scope?{...fence,visibility:scope}:fence}
}
