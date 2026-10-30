import { z } from 'zod';
import { defineTool, ToolRefusal, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import { createIssueInputSchema, acceptIssueInputSchema, deferIssueInputSchema, declineIssueInputSchema } from '../issues/input';
import { createIssue, acceptIssue, deferIssue, declineIssue } from '../issues/mutations';
import { updateIssueSchema } from '../issue-edit/routes';
import { updateIssueRecord } from '../issue-edit/repository';
import { addComment } from '../discussion/repository';
import { nativeDatabase, nativeIssue, nativeResult, standard, issueUri } from './native';
import { asAgent } from './attribution';
import { operatorIntakeInputSchema } from '../operator-intake/input';
import { createOperatorIntake } from '../operator-intake/repository';
import { nativeInputSchema as json } from './schemas';

const output={type:'object',properties:{id:{type:'string'},identifier:{type:'string'}},required:['id','identifier'],additionalProperties:true} as const;
const identifier=z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
const proposedItems=(value:Record<string,unknown>)=>Object.keys(value).filter(key=>key!=='expectedVersion').sort().map(key=>`${key}: ${typeof value[key]==='string'?value[key]:JSON.stringify(value[key])}`);
const link=(issue:{id:string;identifier:string;version?:number},extra:Record<string,unknown>={})=>({result:{id:issue.id,identifier:issue.identifier,version:issue.version,...extra},resources:[{uri:issueUri(issue.id),name:issue.identifier}]});
export const issueTools:ToolDefinition[]=[
  defineTool({name:'vector.intake.intake_creation',title:'Create intake report',description:'Create an internal native intake item with evidence for an explicit triage decision.',scope:'issues:write',readOnly:false,classes:['standard'],clauses:['INTAKE-001','INTAKE-003'],inputSchema:json(operatorIntakeInputSchema),outputSchema:output,
    async classify(args,ctx){await nativeDatabase(ctx,'POST','/intake',{},args);return standard();},summary:args=>({target:{id:String(args.teamId)},items:[String(args.title)]}),
    async run(args,ctx){const input=operatorIntakeInputSchema.parse(args),db=await nativeDatabase(ctx,'POST','/intake',{},input);return nativeResult(()=>asAgent(ctx,async()=>{const value=await createOperatorIntake(db,ctx.person.id,input);return link({...await nativeIssue(ctx,value.identifier),identifier:value.identifier});}));}}),
  defineTool({name:'vector.issue.creation',title:'Create issue',description:'Create a native internal issue with the sponsor’s current team and field authority.',scope:'issues:write',readOnly:false,classes:['standard'],clauses:['ISSUE-001','ISSUE-002'],inputSchema:json(createIssueInputSchema),outputSchema:output,
    async classify(args,ctx){await nativeDatabase(ctx,'POST','/issues',{},args);return standard();},summary:args=>({target:{id:String(args.teamId)},items:[String(args.title)]}),
    async run(args,ctx){const input=createIssueInputSchema.parse(args),db=await nativeDatabase(ctx,'POST','/issues',{},input);return nativeResult(()=>asAgent(ctx,async()=>link(await createIssue(db,ctx.person.id,input))));}}),
  defineTool({name:'vector.issue.concurrent_edits',title:'Update issue',description:'Edit native issue fields using its current version. The same role, team, option and revision checks as the UI apply.',scope:'issues:write',readOnly:false,classes:['standard'],clauses:['ISSUE-003','ISSUE-004','ISSUE-005','ISSUE-006','ISSUE-011','ISSUE-014'],inputSchema:json(z.object({identifier,change:updateIssueSchema})),outputSchema:output,
    async classify(args,ctx){await nativeIssue(ctx,String(args.identifier));await nativeDatabase(ctx,'PATCH','/issues/:identifier',{identifier:String(args.identifier)},args.change);return standard();},
    async revision(args,ctx){return (await nativeIssue(ctx,String(args.identifier))).version;},async target(args,ctx){return {kind:'issue',id:(await nativeIssue(ctx,String(args.identifier))).id};},
    summary:args=>({target:{id:String(args.identifier)},items:proposedItems(args.change as Record<string,unknown>)}),
    async run(args,ctx){const id=String(args.identifier),input=updateIssueSchema.parse(args.change),db=await nativeDatabase(ctx,'PATCH','/issues/:identifier',{identifier:id},input);return nativeResult(()=>asAgent(ctx,async()=>{const state=await updateIssueRecord(db,id,ctx.person.id,input);if(state==='stale')throw new ToolRefusal('revision_conflict');return link({...await nativeIssue(ctx,id),identifier:id});}));}}),
  defineTool({name:'vector.issue.comment',title:'Add comment',description:'Add an internal native issue comment as the agent for the sponsor. This does not send a customer reply.',scope:'comments:write',readOnly:false,classes:['standard'],clauses:['ISSUE-008'],inputSchema:json(z.object({identifier,body:z.string().trim().min(1).max(100000)})),outputSchema:output,
    async classify(args,ctx){await nativeIssue(ctx,String(args.identifier));await nativeDatabase(ctx,'POST','/issues/:identifier/comments',{identifier:String(args.identifier)},args);return standard();},async target(args,ctx){return {kind:'issue',id:(await nativeIssue(ctx,String(args.identifier))).id};},
    summary:args=>({target:{id:String(args.identifier)},items:['Add internal comment',String(args.body)]}),
    async run(args,ctx){const id=String(args.identifier),issue=await nativeIssue(ctx,id),db=await nativeDatabase(ctx,'POST','/issues/:identifier/comments',{identifier:id},args);return nativeResult(()=>asAgent(ctx,async()=>link({...issue,identifier:id},{commentId:await addComment(db,issue.id,ctx.person.id,String(args.body))})));}}),
  ...([
    ['accept',acceptIssueInputSchema,acceptIssue,'INTAKE-005'],
    ['defer',deferIssueInputSchema,deferIssue,'INTAKE-006'],
    ['decline',declineIssueInputSchema,declineIssue,'INTAKE-007'],
  ] as const).map(([verb,schema,run,clause])=>defineTool({name:`vector.intake.${verb}`,title:`${verb} intake`,description:`Record a native ${verb} triage decision with its reason and native version.`,scope:'issues:write',readOnly:false,classes:['standard'],clauses:[clause],inputSchema:json(z.object({identifier,decision:schema})),outputSchema:output,
    async classify(args,ctx){await nativeIssue(ctx,String(args.identifier));await nativeDatabase(ctx,'POST',`/issues/:identifier/${verb}`,{identifier:String(args.identifier)},args.decision);return standard();},async revision(args,ctx){return (await nativeIssue(ctx,String(args.identifier))).version;},async target(args,ctx){return {kind:'issue',id:(await nativeIssue(ctx,String(args.identifier))).id};},
    summary:args=>({target:{id:String(args.identifier)},items:[verb,...proposedItems(args.decision as Record<string,unknown>)]}),
    async run(args,ctx){const id=String(args.identifier),input=schema.parse(args.decision),db=await nativeDatabase(ctx,'POST',`/issues/:identifier/${verb}`,{identifier:id},input);return nativeResult(()=>asAgent(ctx,async()=>{const result=await (run as typeof acceptIssue)(db,ctx.person.id,id,input as z.infer<typeof acceptIssueInputSchema>);if(result.outcome==='stale')throw new ToolRefusal('revision_conflict');return link(result.issue);}));},
  })),
];
