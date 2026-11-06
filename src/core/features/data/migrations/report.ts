import { buildReport,reportCsv,type ReportInput } from '../import/report';
import type { ImportActor } from '../import/authority';
import { readMigration,migrationBatch,migrationGuard,type MigrationReference } from './model';

/** Reports are rebuilt from retained run custody; accepted omissions remain durable. */
export async function migrationReport(db:D1Database,actor:ImportActor,id:string) {
  const migration=await readMigration(db,actor,id);
  const runs=(await db.prepare(`SELECT j.id,j.namespace,j.state,j.total,j.checkpoint,r.report_json FROM vector_migration_runs m
    JOIN ik_jobs j ON j.id=m.job_id JOIN vector_import_reports r ON r.job_id=j.id
    WHERE m.migration_id=? AND j.destination=? ORDER BY m.rowid`).bind(id,actor.workspace).all<{id:string;namespace:string;state:string;total:number;checkpoint:number;report_json:string}>()).results;
  const references=(await db.prepare(`SELECT r.id,r.job_id AS runId,r.source_row AS row,r.source_id AS sourceId,r.target_source_id AS targetSourceId,r.kind,r.state
    FROM vector_migration_references r JOIN ik_jobs j ON j.id=r.job_id WHERE r.migration_id=?
    AND j.state NOT IN ('rolled_back','undone') ORDER BY r.id`).bind(id).all<MigrationReference>()).results;
  const reports=[];
  for(const run of runs) {
    const input=JSON.parse(run.report_json) as ReportInput;
    reports.push({runId:run.id,input,report:await buildReport(db,run,input)});
  }
  // Version changes include run progress and erasure. Do not return a private
  // pre-erasure report or a finish token read across two different lists.
  await migrationBatch(db,actor,[migrationGuard('EXISTS(SELECT 1 FROM vector_file_migrations WHERE id=? AND version=?)',[id,migration.version])]);
  return {
    migration:{id,source:migration.source,state:migration.state,version:migration.version,finishedAt:migration.finished_at},
    runs:runs.map(({report_json:_report,namespace:_namespace,...run})=>run),
    pending:references.filter(row=>row.state==='pending'),omissions:references.filter(row=>row.state==='omitted'),
    totals:{rowsRead:reports.reduce((n,row)=>n+row.report.totals.rowsRead,0),issuesWritten:reports.reduce((n,row)=>n+row.report.totals.issuesWritten,0)},
    reports:reports.map(({input:_input,...row})=>row),
    csv:reports.map(row=>'Run '+row.runId+'\r\n'+reportCsv(row.report,row.input)).join('\r\n'),
  };
}
export function migrationCsv(report:Awaited<ReturnType<typeof migrationReport>>) {
  const cell=(value:string|number)=>{const text=String(value),safe=/^[=+@\-\t\r]/.test(text)?"'"+text:text;return '"'+safe.replaceAll('"','""')+'"';};
  const references=[...report.pending,...report.omissions];
  return 'reference_id,run_id,source_row,source_id,relation,target_source_id,disposition\r\n'+references.map(row=>[row.id,row.runId,row.row,row.sourceId,row.kind,row.targetSourceId,row.state].map(cell).join(',')).join('\r\n')+'\r\n\r\n'+report.csv;
}
