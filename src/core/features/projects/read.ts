import { readProjectDependencies } from '../project-dependencies/repository';
import { dependencyActivity } from '../project-dependencies/activity';
import { readProjectReport } from "../project-report/read";
import { settingsActor } from '../settings/repository';
import { loadWorkspaceSnapshot } from '../streams';
import { readProjectCycleHistory } from '../cycle-closure/read';
import { getProjectDetail } from './service';
import { readPortfolio, type ProjectPortfolioQuery } from './portfolio';
import { readProjectForecast } from '../project-forecasts/read';
import { visibilityDatabase } from '../roles/visibility-database';

export async function projectPortfolio(db:D1Database, actor:string, query:ProjectPortfolioQuery) {
  const access=await settingsActor(db,actor);
  const snapshot=await loadWorkspaceSnapshot(db);
  snapshot.projects=snapshot.projects.filter(project=>project.workspaceId===access.workspace_id);
  return readPortfolio(snapshot,query);
}
export async function projectDetail(db:D1Database,actor:string,id:string,at=new Date()) {
  db=visibilityDatabase(db,actor);
  const access=await settingsActor(db,actor);
  const snapshot=await loadWorkspaceSnapshot(db);
  if(!snapshot.projects.some(project=>project.id===id&&project.workspaceId===access.workspace_id))return null;
  const project=getProjectDetail(snapshot,id,at);
  if(!project)return null;
  const [cycleHistory,activity,report,forecast,directDependencies]=await Promise.all([
    readProjectCycleHistory(db,id),
    db.prepare(`SELECT a.id,a.kind,a.previous_value_json AS previousValue,a.next_value_json AS nextValue,a.created_at AS createdAt,o.name AS actorName FROM project_activity a LEFT JOIN operators o ON o.id=a.actor_operator_id WHERE a.project_id=? ORDER BY a.created_at DESC,a.id DESC`).bind(id).all<{id:string;kind:string;previousValue:string;nextValue:string;createdAt:string;actorName:string|null}>(),
    readProjectReport(db,id,at),
    readProjectForecast(db,snapshot,id,at),
    readProjectDependencies(db,id),
  ]);
  return {...project,directDependencies,cycleHistory,report,forecast,activity:dependencyActivity(activity.results.map(a=>({...a,previousValue:JSON.parse(a.previousValue),nextValue:JSON.parse(a.nextValue)})),id,snapshot.projects)};
}
