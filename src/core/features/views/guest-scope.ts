import type { IssueListQuery } from '../issues/list-schema'
import { ViewError } from './repository'

/** Personal views may mean “all I can see”; an explicit hidden team or
 * project is unavailable. The request database scopes the actual result. */
export async function requireGuestViewScope(db:D1Database, actor:string, query:IssueListQuery) {
  if (query.team !== 'all' && !await db.prepare('SELECT 1 FROM teams WHERE id=? AND EXISTS(SELECT 1 FROM operators WHERE id=? AND removed_at IS NULL)').bind(query.team,actor).first())
    throw new ViewError('not_found','The selected team is unavailable.',404)
  if (!['all','none'].includes(query.project) && !await db.prepare('SELECT 1 FROM projects WHERE id=?').bind(query.project).first())
    throw new ViewError('not_found','The selected project is unavailable.',404)
}
