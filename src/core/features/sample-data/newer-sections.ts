import {createInitiative,replaceInitiativeProjects} from '../initiatives/repository';
import {createRelease,replaceReleaseScope} from '../releases/repository';
import {createDocument} from '../documents/repository';
import {saveDashboard} from '../dashboards/service';
import {issueListQuerySchema} from '../issues/list-schema';
import {insightQuerySchema} from '../insights/schema';

type Sample={owner:string;now:Date;teams:{flow:string;platform:string};projects:{reliability:string;hardening:string}};
const day=(now:Date,days:number)=>new Date(now.getTime()+days*86_400_000).toISOString().slice(0,10);

/** The newer sections open with something to look at: an initiative over the demo projects, a release with scope,
 * a team document and a dashboard, all written through the same services the screens use. */
export async function seedNewerSections(db:D1Database,{owner,now,teams,projects}:Sample){
 const initiative=await createInitiative(db,owner,{
  name:'Reliable webhook delivery',ownerOperatorId:owner,parentId:null,status:'active',targetDate:day(now,45),
  description:'Customers should never lose a webhook. This groups the reliability and platform work that gets delivery back inside tolerance.',
 });
 await replaceInitiativeProjects(db,owner,initiative.id,{expectedVersion:initiative.version,projectIds:[projects.reliability,projects.hardening]});
 const release=await createRelease(db,owner,{
  name:'Retry contract 1.0',teamId:teams.platform,status:'in_progress',targetDate:day(now,14),
  description:'Ships the agreed retry behaviour and the dashboard that shows it.',
 });
 await replaceReleaseScope(db,owner,release.id,{expectedVersion:release.version,issueIdentifiers:['PLT-101','PLT-102','PLT-103'],projectIds:[]});
 await createDocument(db,owner,{
  parentKind:'team',parentId:teams.flow,title:'Webhook delivery runbook',
  body:'## When delivery slips\n\n1. Check the retry telemetry on the current cycle.\n2. Confirm how many customers are affected before changing anything.\n3. Post the status in the team channel and link the issue.\n\n## Who to ask\n\nThe on-call lead for Flow owns the first response.',
 });
 const filters=(query:object)=>issueListQuerySchema.parse(query),chart=(query:object)=>insightQuerySchema.parse(query);
 await saveDashboard(db,owner,{
  name:'Delivery health',teamId:null,isShared:true,widgets:[
   {name:'Created vs completed',kind:'chart',filters:filters({}),chart:chart({metric:'flow'})},
   {name:'In progress',kind:'count',filters:filters({category:'started'}),chart:chart({})},
   {name:'Ready to start',kind:'list',filters:filters({category:'unstarted'}),chart:chart({})},
  ],
 });
}
