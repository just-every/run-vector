import { loadWorkspaceSnapshot } from '../streams';
import { visibilityDatabase } from '../roles/visibility-database';
import { getProjectDetail } from '../projects/service';
import { recipientInitiatives } from './recipients';
export type DigestSnapshot = Record<string,{targetDate: string|null; risks: string[]; milestones: string[]}>;
export type DigestContent = {text: string; snapshot: DigestSnapshot};
const label = (value: string) => value.replaceAll(/[\r\n\t]/g,' ');
/** Only recipient-visible native fields and computed facts reach this projection.
 * The persisted comparison stores identities, dates and risk keys, never prose. */
export async function leadershipContent(db: D1Database, actor: string, workspace: string, origin: string,
  now: Date, previous: DigestSnapshot): Promise<DigestContent|null> {
  db = visibilityDatabase(db,actor);
  const initiatives = await recipientInitiatives(db,actor,workspace);
  if (!initiatives.length) return null;
  const data = await loadWorkspaceSnapshot(db), snapshot: DigestSnapshot = {}, lines: string[] = ['Weekly leadership digest',''];
  const link = (path: string) => new URL(path,origin).href;
  for (const initiative of initiatives) {
    const key = 'initiative:'+initiative.id, old = previous[key];
    lines.push(label(initiative.name)+' — '+initiative.status+' · Target: '+(initiative.targetDate??'Not scheduled'),link('/app/initiatives/'+initiative.id));
    if (old?.targetDate && initiative.targetDate && initiative.targetDate>old.targetDate)
      lines.push('Target slipped: '+old.targetDate+' → '+initiative.targetDate+' · '+link('/app/initiatives/'+initiative.id));
    snapshot[key] = {targetDate: initiative.targetDate,risks: [],milestones: []};
    const ids = (await db.prepare('SELECT project_id id FROM initiative_projects WHERE initiative_id=? ORDER BY project_id')
      .bind(initiative.id).all<{id: string}>()).results;
    for (const {id} of ids) {
      const project = getProjectDetail(data,id,now);
      if (!project) continue;
      const projectKey = 'project:'+id, prior = previous[projectKey], url = link('/app/projects/'+id);
      lines.push('  '+label(project.name)+' — '+project.lifecycle+' · Health: '+project.health+' · Target: '+(project.targetDate??'Not scheduled'),url);
      if (prior?.targetDate && project.targetDate && project.targetDate>prior.targetDate && project.lifecycle!=='paused')
        lines.push('  Target slipped: '+prior.targetDate+' → '+project.targetDate+' · '+url);
      const risks = project.risks.map(risk => ({risk,key: JSON.stringify([risk.kind,[...(risk.issueIdentifiers??[])].sort(),risk.capacity??null])}));
      for (const {risk,key} of risks) if (!prior?.risks.includes(key)) {
        lines.push('  New risk: '+label(risk.message)+' · '+url);
        for (const identifier of risk.issueIdentifiers??[]) lines.push('    '+identifier+' · '+link('/app/issues/'+encodeURIComponent(identifier)));
      }
      const completed = project.milestones.filter(m=>m.completed);
      // The first digest establishes a baseline; subsequent sends report transitions.
      for (const milestone of completed) if (prior && !prior.milestones.includes(milestone.id))
        lines.push('  Milestone completed: '+label(milestone.name)+' · '+url+'#milestone-'+encodeURIComponent(milestone.id));
      snapshot[projectKey] = {targetDate: project.targetDate,risks: risks.map(r=>r.key),milestones: completed.map(m=>m.id)};
    }
    lines.push('');
  }
  return {text: lines.join('\n'),snapshot};
}
