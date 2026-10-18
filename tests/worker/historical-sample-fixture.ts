import { buildVectorSample } from '../../sample-data/vector';
import { sampleDataSchema } from '../../src/core/features/sample-data/schema';

/** Seed the 0002 schema by the fixture's own columns. Current Drizzle table
 * definitions also emit newly added default columns, which do not exist yet. */
export async function insertHistoricalSample(db:D1Database,now:Date) {
  const sample=sampleDataSchema.parse(buildVectorSample(now));
  const groups:Array<[string,Array<Record<string,unknown>>]>=[
    ['workspace_settings',[sample.workspace]],['operators',sample.operators],['operator_sessions',sample.sessions],
    ['teams',sample.teams],['workflow_statuses',sample.workflowStatuses],['projects',sample.projects],['cycles',sample.cycles],
    ['labels',sample.labels],['issues',sample.issues],['issue_labels',sample.issueLabels],['issue_dependencies',sample.dependencies],
    ['evidence_revisions',sample.evidence],['intake_decisions',sample.decisions],['issue_activity',sample.activity],
    ['saved_views',sample.savedViews],['list_preferences',sample.listPreferences],
  ];
  for(const [table,rows] of groups)for(const row of rows) {
    const keys=Object.keys(row);
    const columns=keys.map(key=>key.replace(/[A-Z]/g,char=>'_'+char.toLowerCase()));
    await db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`)
      .bind(...keys.map(key=>typeof row[key]==='boolean'?Number(row[key]):row[key])).run();
  }
  await db.prepare('INSERT INTO team_issue_sequences(team_id,last_sequence,updated_at) SELECT team_id,MAX(sequence_number),MAX(updated_at) FROM issues GROUP BY team_id').run();
}
