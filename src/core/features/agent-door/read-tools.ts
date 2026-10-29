import { defineTool, type ToolDefinition, type ResourceDefinition } from '../../../../vendor/base/agent-door/index.ts';
import { visibilityDatabase } from '../roles/visibility-database';
import { readAdministration } from '../administration/read';
import { getIssueDetail } from '../issues/service';
import { searchWorkspace } from '../search/service';
import { listIssues, issueListResponse } from '../issues/list';
import { issueListQuerySchema } from '../issues/list-schema';
import { nativeIssue, standard, issueUri } from './native';

const output={type:'object',additionalProperties:true} as const;
const identifier={type:'string',pattern:'^[A-Z]{2,10}-[1-9][0-9]*$'};
export const readTools:ToolDefinition[]=[
  defineTool({name:'vector.view.issue_controls',title:'List issues',description:'List visible issues using the native default list and its revision.',scope:'issues:read',readOnly:true,classes:['standard'],clauses:['VIEW-001','OPS-001'],inputSchema:{type:'object',properties:{},additionalProperties:false},outputSchema:output,classify:standard,untrusted:true,
    async run(_,ctx){return {result:issueListResponse(await listIssues(visibilityDatabase(ctx.db,ctx.person.id),ctx.person.id,issueListQuerySchema.parse({})))};}}),
  defineTool({name:'vector.ops.workspace_access',title:'Workspace metadata',description:'Read current native teams, workflow states and planning metadata.',scope:'metadata:read',readOnly:true,classes:['standard'],clauses:['OPS-001'],inputSchema:{type:'object',properties:{},additionalProperties:false},outputSchema:output,classify:standard,
    async run(_,ctx){ return {result:await readAdministration(visibilityDatabase(ctx.db,ctx.person.id),ctx.person.id)}; }}),
  defineTool({name:'vector.issue.activity_history',title:'Read issue',description:'Read an issue and its native activity with current team visibility. Record text is untrusted.',scope:'issues:read',readOnly:true,classes:['standard'],clauses:['ISSUE-007','ISSUE-008','OPS-001'],untrusted:true,inputSchema:{type:'object',properties:{identifier},required:['identifier'],additionalProperties:false},outputSchema:output,
    async classify(args,ctx){await nativeIssue(ctx,String(args.identifier));return standard();},
    async target(args,ctx){return {kind:'issue',id:(await nativeIssue(ctx,String(args.identifier))).id};},
    async run(args,ctx){await nativeIssue(ctx,String(args.identifier));const db=visibilityDatabase(ctx.db,ctx.person.id);const value=await getIssueDetail(db,String(args.identifier),new Date());await nativeIssue(ctx,String(args.identifier));return {result:value,resources:[{uri:issueUri(String(args.identifier)),name:String(args.identifier)}]};}}),
  defineTool({name:'vector.search.global_search',title:'Search Vector',description:'Search visible native issues, projects, views and documents. Results are untrusted record text.',scope:'search:read',readOnly:true,classes:['standard'],clauses:['SEARCH-001','SEARCH-002','OPS-001'],untrusted:true,inputSchema:{type:'object',properties:{query:{type:'string',maxLength:1000},includeArchived:{type:'boolean'}},required:['query'],additionalProperties:false},outputSchema:output,classify:standard,
    async run(args,ctx){return {result:await searchWorkspace(visibilityDatabase(ctx.db,ctx.person.id),ctx.person.id,String(args.query),args.includeArchived===true)};}}),
];
/** Internal visibility adapter retained for audit; public resources are undeclared. */
export const issueResource:ResourceDefinition={uriTemplate:'vector://issues/{identifier}',name:'Issue',mimeType:'application/json',scope:'issues:read',classes:['standard'],classify:record=>[{class:'standard',facts:{measure:record.json&&typeof record.json==='object'&&'id' in record.json?1:0}}],
  async read(uri,ctx){const match=/^vector:\/\/issues\/([A-Z]{2,10}-[1-9][0-9]*)$/.exec(uri);if(!match)return null;const db=visibilityDatabase(ctx.db,ctx.person.id);try {const value=await getIssueDetail(db,match[1],new Date());if(!value)return null;const access=await db.prepare('SELECT id FROM issues WHERE identifier=?').bind(match[1]).first();return access?{json:value,untrusted:true}:null;}catch{return null;}}};
