import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {roleScreens} from '../role-ui-support.mjs';
import {navigate,settleReads,trackRequests} from '../collaboration-navigation.mjs';
import {confirmLink,readDevelopmentLink} from '../outbox-session.mjs';
export async function exerciseGithubChain({page:shared,runtime,cookie,team,width,evidence}){
 const page=await shared.context().newPage();trackRequests(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/hydration|did not match|Minified React error #(418|423|425)/i.test(m.text()))errors.push(m.text());});
 const inspect=roleScreens(evidence),headers={Cookie:cookie,Origin:runtime.base,'Content-Type':'application/json'};
 const call=async(path,method='GET',body,status=200)=>{const res=await runtime.req('/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});assert.equal(res.status,status,await res.clone().text());return res.json();};
 try{
  const initial=await call('/settings/administration'),current=initial.teams.find(t=>t.id===team.id);
  if(!current.statuses.some(s=>s.name==='In Review'))await call('/settings/teams/'+team.id+'/statuses','POST',{name:'In Review',category:'started'});
  const state=await call('/settings/administration'),statuses=state.teams.find(t=>t.id===team.id).statuses;
  const review=statuses.find(s=>s.name==='In Review'),started=statuses.find(s=>s.category==='started'),done=statuses.find(s=>s.category==='completed');
  const config=await call('/settings/integrations/github','POST',{name:'synthetic-vector-1710 '+width,repository:'synthetic-vector-1710/chain-'+width},201);
  await page.setViewportSize({width,height:900});await navigate(page,runtime.base+'/app/settings');
  const rules=page.getByRole('region',{name:'Git automation rules',exact:true});await rules.getByText(team.name+' Git automation',{exact:true}).click();
  for(const [trigger,label,status] of [['draft','Draft PR opened',started.id],['review','Review requested',review.id],['merged','PR merged',done.id]]){
   await rules.getByLabel(team.name+' '+label+' status',{exact:true}).selectOption(status);
   const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api/settings/teams/'+team.id);
   await rules.getByRole('button',{name:'Save '+label+' rule',exact:true}).click();assert.equal((await saved).status(),200);
   await settleReads(page);
  }
  await inspect(page,rules,'github-rules-'+width);
  const issue=await call('/issues','POST',{teamId:team.id,title:'synthetic-vector-1711 Fix checkout '+width},201);
  await navigate(page,runtime.base+'/app/issues/'+issue.identifier);
  const branch=page.getByRole('region',{name:'Git branch',exact:true});const expected=issue.identifier.toLowerCase()+'-synthetic-vector-1711-fix-checkout-'+width;
  assert.equal(await branch.getByLabel('Branch name',{exact:true}).inputValue(),expected);
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await branch.getByRole('button',{name:'Copy branch name',exact:true}).click();await branch.getByRole('status').getByText('Branch name copied.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected);
  await inspect(page,branch,'github-branch-'+width);
  const send=async(body,delivery=randomUUID(),event='pull_request')=>{
   const text=JSON.stringify(body),signature=createHmac('sha256',config.secret).update(text).digest('hex');
   const response=await fetch(config.receiver,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+signature,'X-GitHub-Delivery':delivery,'X-GitHub-Event':event},body:text});
   assert.equal(response.status,200,await response.clone().text());return response.json();
  };
  const receipts=[];
  for(const [action,updated_at,status] of [['opened','2026-10-10T01:00:00.000Z',started.id],['review_requested','2026-10-10T02:00:00.000Z',review.id],['closed','2026-10-10T03:00:00.000Z',done.id]]){
   const merged=action==='closed',body={action,number:71,repository:{full_name:'synthetic-vector-1710/chain-'+width},pull_request:{number:71,title:'Fixes '+issue.identifier,body:null,head:{ref:expected},draft:!merged,merged,state:merged?'closed':'open',merge_commit_sha:merged?'a'.repeat(40):null,updated_at,html_url:'https://github.com/synthetic-vector-1710/chain-'+width+'/pull/71'}},delivery=randomUUID();
   receipts.push({body,delivery});await send(body,delivery);assert.equal((await call('/issues/'+issue.identifier)).status.id,status);
  }
  const before=await call('/issues/'+issue.identifier);
  assert.equal(before.activity.filter(a=>a.kind==='issue.status_changed'&&a.actor==='Git automation').length,3);
  for(const receipt of receipts)await send(receipt.body,receipt.delivery);
  const after=await call('/issues/'+issue.identifier);assert.equal(after.version,before.version);
  const notices=runtime.sql("SELECT actor_id,actor_name,causes_json FROM notifications WHERE issue_id='"+issue.id+"'");assert.equal(notices.length,3);assert.equal(notices.filter(n=>JSON.parse(n.causes_json).includes('completed')).length,1);assert.ok(notices.every(n=>n.actor_id===null&&n.actor_name==='Git automation'));
  await navigate(page,runtime.base+'/app/issues/'+issue.identifier);await page.getByRole('link',{name:'Fixes '+issue.identifier+' · synthetic-vector-1710/chain-'+width+' #71',exact:true}).waitFor();
  await inspect(page,page.locator('.issue-inspector'),'github-linked-issue-'+width);
  // Native Guest invitation and confirmation in this disposable test workspace.
  const email='synthetic-vector-1712-'+width+'@example.test';
  await call('/settings/operators/invite','POST',{displayName:'synthetic-vector-1712',email,role:'guest',teamIds:[team.id]},202);
  const link=await readDevelopmentLink(runtime.base,null,email,runtime.state),signed=await confirmLink(link);assert.equal(signed.status,303);
  const guestCookie=signed.headers.get('set-cookie').split(';')[0];
  const refused=await runtime.req('/api/settings/teams/'+team.id,{method:'PATCH',headers:{...headers,Cookie:guestCookie},body:JSON.stringify({githubAutomation:{trigger:'draft',statusId:null,allowReopen:false,expectedVersion:0}})});
  assert.equal(refused.status,403);await refused.body.cancel();
  assert.deepEqual(errors,[],'GitHub screens have no browser or hydration errors');
 }catch(error){console.error('Git rule controls:',await page.getByRole('region',{name:'Git automation rules',exact:true}).ariaSnapshot().catch(()=>''));throw error;}finally{await settleReads(page);await page.close();}
}
