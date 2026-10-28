import {calendarAuthority} from '../calendar-feeds/service';
import {browseActor,workspaceDate} from '../issues/browse-access';
import {listIssues} from '../issues/list';
import type {IssueListQuery} from '../issues/list-schema';

export async function readIssueTimeline(db:D1Database,actor:string,query:IssueListQuery){
  await calendarAuthority(db,actor);
  const access=await browseActor(db,actor),now=new Date();
  const list=await listIssues(db,actor,query,now);
  const ids=list.issues.map(issue=>issue.id);
  // Both endpoints use the request's current visible issue set. Dependency
  // labels and geometry must never reveal an issue from a hidden team.
  const dependencies=ids.length?(await db.prepare(`SELECT blocking.identifier blocking,blocked.identifier blocked
    FROM issue_dependencies d JOIN issues blocking ON blocking.id=d.blocking_issue_id
    JOIN issues blocked ON blocked.id=d.blocked_issue_id
    WHERE blocking.id IN (SELECT value FROM json_each(?)) AND blocked.id IN (SELECT value FROM json_each(?))`)
    .bind(JSON.stringify(ids),JSON.stringify(ids)).all<{blocking:string;blocked:string}>()).results:[];
  await calendarAuthority(db,actor);
  return {...list,today:workspaceDate(now,access.timezone),timezone:access.timezone,canEdit:access.role!=='viewer',dependencies};
}
