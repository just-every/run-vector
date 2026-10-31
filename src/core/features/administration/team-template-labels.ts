import {defaultIssueTemplateSchema} from './default-issue-template';
import {audit,guard,SettingsError,type AdministrationContext} from './transaction';

/** A workspace label's lifecycle also updates portable team defaults atomically. */
export async function teamTemplateLabelStatements(ctx:AdministrationContext,source:string,destination:string|null) {
 const rows=await ctx.db.prepare("SELECT id,name,default_issue_template_json FROM main.teams WHERE workspace_id=? AND default_issue_template_json IS NOT NULL").bind(ctx.workspace).all<{id:string;name:string;default_issue_template_json:string}>();
 const writes:D1PreparedStatement[]=[];
 for(const team of rows.results) {
  const parsed=defaultIssueTemplateSchema.safeParse(JSON.parse(team.default_issue_template_json));
  if(!parsed.success)throw new SettingsError('invalid_template','Repair an invalid team default before changing its labels.',409);
  const previous=parsed.data.labelIds;
  if(!previous.includes(source))continue;
  const labelIds=[...new Set(previous.flatMap(id=>id===source ? (destination?[destination]:[]) : [id]))];
  writes.push(guard(ctx.db,'EXISTS(SELECT 1 FROM teams WHERE id=? AND default_issue_template_json=?)',team.id,team.default_issue_template_json),
   ctx.db.prepare("UPDATE teams SET default_issue_template_json=json_set(default_issue_template_json,'$.labelIds',json(?)),updated_at=? WHERE id=?").bind(JSON.stringify(labelIds),ctx.at,team.id),
   ...audit(ctx,'team.default_template_labels_changed',team.id,team.name,{labelIds:previous},{labelIds}));
 }
 return writes;
}
