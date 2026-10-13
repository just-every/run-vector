import {it} from 'vitest';
import {expect} from 'vitest';
import {provePopulatedUpgrade} from './populated-upgrade';
import {request} from './base-auth-fixture';
import {sampleBindings} from './sample-auth-fixture';
it('[DATA-007 DATA-008] a populated workspace keeps every row, index and trigger when reports and imported comment authors are added',async()=>provePopulatedUpgrade('0036_import_reports.sql',{
 added:['table vector_import_reports'],removed:[],changed:['table issue_comments'],until:'0037_imported_comment_authors.sql',
},['cycles','issues','issue_comments','issue_files','evidence_revisions','operators','oa_sessions','oa_tokens','integration_tokens'],async cookie=>{
 const token=await request('/api/settings/integrations/tokens','POST',{name:'Upgrade token',scopes:['issues:read']},cookie,sampleBindings);
 expect(token.status).toBe(201);
}),120_000);
