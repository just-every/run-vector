import { ToolRefusal, type Person } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { vectorPeople } from './people.ts';
import { visibilityDatabase } from '../roles/visibility-database';
import { requireIssueAccess } from '../issues/access';
import { getIssueDetail } from '../issues/service';
import { listIssues, issueListResponse } from '../issues/list';
import { issueListQuerySchema } from '../issues/list-schema';
import { projectPortfolio, projectDetail } from '../projects/read';
import { projectPortfolioQuery } from '../projects/portfolio';
import { readAdministration, readCycle } from '../administration/read';
import { z } from 'zod';

export const identifier = z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
export const nativeId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
export const issueArgs = z.object({ identifier });
export const idArgs = z.object({ id: nativeId });

/** Use the same native projections as the UI and versioned API. Current native
 * admission and grants fence the asynchronous projection. */
export async function nativeRead<T>(env: WorkerBindings, sponsor: Person, read: (db: D1Database) => Promise<T>): Promise<T> {
  const people = vectorPeople(env);
  if (!(await people.person(sponsor.id))) throw new ToolRefusal('unauthenticated');
  const grantSnapshot = () => env.DB.prepare(`SELECT json_object('workspace',o.workspace_id,'role',o.role,
    'teams',(SELECT json_group_array(json_array(id,is_private)) FROM (SELECT id,is_private FROM main.teams WHERE workspace_id=o.workspace_id ORDER BY id)),
    'memberships',(SELECT json_group_array(json_array(team_id,role)) FROM (SELECT team_id,role FROM main.team_members WHERE operator_id=o.id ORDER BY team_id))) AS snapshot
    FROM main.operators o WHERE o.id=? AND o.removed_at IS NULL`).bind(sponsor.id).first<string>('snapshot');
  const before = await grantSnapshot();
  const db = visibilityDatabase(env.DB, sponsor.id);
  try {
    const value = await read(db);
    if (!(await people.person(sponsor.id))) throw new ToolRefusal('unauthenticated');
    if (!before || before !== await grantSnapshot()) throw new ToolRefusal('not_found');
    return value;
  } catch (error) {
    if (error instanceof ToolRefusal) throw error;
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String(error.code);
      if (code.endsWith('not_found')) throw new ToolRefusal('not_found');
      if (['forbidden', 'unauthenticated'].includes(code)) throw new ToolRefusal(code);
    }
    throw error;
  }
}

export const readIssue = (env: WorkerBindings, sponsor: Person, key: string) => nativeRead(env, sponsor, async db => {
  await requireIssueAccess(db, key, sponsor.id);
  const issue = await getIssueDetail(db, key, new Date());
  await requireIssueAccess(db, key, sponsor.id);
  if (!issue) throw new ToolRefusal('not_found');
  return issue;
});
export const readIssues = (env: WorkerBindings, sponsor: Person, args: unknown) => nativeRead(env, sponsor,
  async db => issueListResponse(await listIssues(db, sponsor.id, issueListQuerySchema.parse(args))));
export const readProjects = (env: WorkerBindings, sponsor: Person, args: unknown) => nativeRead(env, sponsor,
  db => projectPortfolio(db, sponsor.id, projectPortfolioQuery.parse(args)));
export const readProject = (env: WorkerBindings, sponsor: Person, id: string) => nativeRead(env, sponsor, async db => {
  const value = await projectDetail(db, sponsor.id, id);
  if (!value) throw new ToolRefusal('not_found');
  return value;
});
export const readMetadata = (env: WorkerBindings, sponsor: Person) => nativeRead(env, sponsor,
  db => readAdministration(db, sponsor.id));
export const readNativeCycle = (env: WorkerBindings, sponsor: Person, id: string) => nativeRead(env, sponsor,
  db => readCycle(db, sponsor.id, id));
