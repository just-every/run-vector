import type { Context } from 'hono'
import { matchedRoutes } from 'hono/route'
import type { AppEnvironment } from '../../app/bindings'
import { readRequestJson } from '../../app/input'
import type { NativeAccessFence } from '../auth/mutation-database'
import { authorityFence, loadAuthority } from './authority'
import { apiDoors, doors, type DoorRequest } from './doors'
import { decide, decisionInputs } from './policy'

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
  const row = door ? typeof door.row === 'function' ? await door.row(request) : door.row : null
  const teams = door?.teams ? await door.teams(request) : null
  const project = door?.project ? await door.project(request) : undefined
  const question = { row, page: door?.page, teams, project, invitation: door?.invitation }
  const authority = await loadAuthority(source, actor, teams ?? [], project ?? undefined)
  if (!authority) return { denied: c.json({ error: 'unauthenticated', message: 'Sign in again to continue.' }, 401, { 'Cache-Control': 'no-store' }) }
  const decision = decide(authority, question)
  if (decision === 'hidden') return { denied: c.json({ error: 'not_found', message: 'The selected record is unavailable.' }, 404, { 'Cache-Control': 'no-store' }) }
  if (decision === 'forbidden') return { denied: c.json({ error: 'forbidden', message: 'Your workspace role does not allow this action.' }, 403, { 'Cache-Control': 'no-store' }) }
  return read ? {} : { fence: authorityFence(actor, authority, decisionInputs(authority, question)) }
}
