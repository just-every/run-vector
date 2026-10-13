import type { ImportDiagnostic } from './types';
import type { ReportInput } from './report';

type ReviewedOmission=Omit<ImportDiagnostic,'row'>;
/** Reuse the original decision, not today's reference availability. Read each
 * owning run once, without loading its full occurrence review for every issue. */
export async function readJiraReviewedOmissions(db:D1Database,jobIds:string[]) {
 const result=new Map<string,Map<string,ReviewedOmission[]>>(),jobs=[...new Set(jobIds)];
 for(let start=0;start<jobs.length;start+=1000) {
  const reports=(await db.prepare(`SELECT job_id,json_extract(report_json,'$.rows') AS rows_json,
   json_extract(report_json,'$.omissions') AS omissions_json,json_extract(report_json,'$.erasedRows') AS erased_json
   FROM vector_import_reports WHERE job_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(jobs.slice(start,start+1000))).all<{job_id:string;rows_json:string;omissions_json:string;erased_json:string|null}>()).results;
  for(const report of reports) {
   const rows=JSON.parse(report.rows_json) as ReportInput['rows'],omissions=JSON.parse(report.omissions_json) as ReportInput['omissions'];
   const erased=new Set<number>(JSON.parse(report.erased_json??'[]')),byRow=new Map<number,ReviewedOmission[]>();
   for(const {rows:affected,...item} of omissions)for(const row of affected) {
    const items=byRow.get(row)??[];items.push(item);byRow.set(row,items);
   }
   result.set(report.job_id,new Map(rows.filter(([row])=>!erased.has(row)).map(([row,sourceId])=>[sourceId,byRow.get(row)??[]])));
  }
 }
 return result;
}
