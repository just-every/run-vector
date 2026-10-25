import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {beforePrivateNavigation} from './collaboration-navigation.mjs';
const require=createRequire(import.meta.url);

export async function projectDocumentsJourney({page,base,api,output}){
 await mkdir(output,{recursive:true});
 const errors=[];
 const pageError=error=>errors.push(String(error));
 const consoleError=message=>{if(message.type()==='error'&&/hydrat|server.render|react error/i.test(message.text()))errors.push(message.text());};
 page.on('pageerror',pageError);page.on('console',consoleError);
 const go=async path=>{await beforePrivateNavigation(page,base+path);await page.goto(base+path);};
 async function proof(name,width){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' horizontal overflow');
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const violations=await page.evaluate(async()=>{const result=await window.axe.run(document);return result.violations.filter(v=>v.impact==='serious'||v.impact==='critical').map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});
  assert.deepEqual(violations,[],name+' serious/critical axe');
  assert.deepEqual(errors,[],name+' hydration and page errors');
  await page.screenshot({path:output+'/'+name+'-'+width+'.png',fullPage:true});
 }
 try{
  const {operatorId}=await api('/session');
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});
   const suffix=String(Date.now()),name='synthetic-vector-documents-'+width+'-'+suffix;
   const prefix='DOC'+suffix.slice(-6).replaceAll(/\d/g,d=>String.fromCharCode(65+Number(d)));
   const team=(await api('/settings/teams','POST',{name:name+' team',identifierPrefix:prefix})).teams.find(t=>t.name===name+' team');
   const project=(await api('/settings/projects','POST',{name:name+' project',leadOperatorId:operatorId})).projects.find(p=>p.name===name+' project');
   const issue=await api('/issues','POST',{teamId:team.id,projectId:project.id,title:name+' issue'});
   const initiative=await api('/initiatives','POST',{name:name+' initiative',ownerOperatorId:operatorId});
   const initiativeDoc=await api('/documents','POST',{parentKind:'initiative',parentId:initiative.id,title:name+' initiative handbook',body:'Initiative document body'});
   const teamDoc=await api('/documents','POST',{parentKind:'team',parentId:team.id,title:name+' team runbook',body:'Team document body'});
   const issueDoc=await api('/documents','POST',{parentKind:'issue',parentId:issue.id,title:name+' issue notes',body:'Issue document body'});
   await go('/app/projects/'+project.id);
   const section=page.getByRole('region',{name:'Documents',exact:true});
   await section.locator('summary').filter({hasText:'New document'}).click();
   const draft=section.getByRole('form',{name:'Document draft'}),title=name+' spec';
   await draft.getByLabel('Document title',{exact:true}).fill(title);
   await draft.getByLabel('Document body',{exact:true}).fill('# Original plan\n\nOriginal spec body');
   await proof('project-document-draft',width);
   await draft.getByRole('button',{name:'Create document',exact:true}).click();
   await page.getByRole('heading',{name:title,exact:true}).waitFor();
   const documentId=new URL(page.url()).pathname.split('/').at(-1);
   assert.match(documentId,/^[0-9A-HJKMNP-TV-Z]{26}$/);
   const bodies=['## First review\n\nFirst edited specification','## Approved plan\n\nSecond edited specification'];
   for(const body of bodies){
    const editor=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Edit document'})});
    if(await editor.getAttribute('open')===null)await editor.locator('summary').click();
    const form=editor.getByRole('form',{name:'Edit document'});
    await form.getByLabel('Document body',{exact:true}).fill(body);
    await form.getByRole('button',{name:'Save document',exact:true}).click();
    await page.getByRole('region',{name:'Document content'}).getByText(body.split('\n').at(-1),{exact:true}).waitFor();
   }
   const history=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Revision history'})});
   await history.locator('summary').click();
   await history.getByRole('heading',{name:'Revision 2',exact:true}).waitFor();
   await history.getByRole('heading',{name:'Revision 3',exact:true}).waitFor();
   assert.equal(await history.getByText('First edited specification',{exact:true}).count(),1);
   assert.equal(await history.getByText('Second edited specification',{exact:true}).count(),1);
   await proof('document-revisions',width);
   await go('/app/projects/'+project.id);
   await page.getByRole('region',{name:'Documents',exact:true}).getByRole('link',{name:title,exact:true}).waitFor();
   await proof('project-documents-list',width);
   await go('/app/issues/'+issue.identifier);
   const spec=page.getByRole('region',{name:'Issue specification',exact:true});
   await spec.locator('summary').click();
   await spec.getByLabel('Specification document',{exact:true}).selectOption(documentId);
   await spec.getByRole('button',{name:'Save specification',exact:true}).click();
   await spec.getByRole('link',{name:title,exact:true}).waitFor();
   await page.getByRole('region',{name:'Documents',exact:true}).getByRole('link',{name:issueDoc.title,exact:true}).waitFor();
   assert.equal((await api('/issues/'+issue.identifier)).specification.id,documentId);
   await proof('issue-specification',width);
   await spec.getByRole('link',{name:title,exact:true}).click();
   await page.getByRole('heading',{name:title,exact:true}).waitFor();
   await page.getByRole('region',{name:'Document content'}).getByText('Second edited specification',{exact:true}).waitFor();
   await proof('followed-specification',width);
   await go('/app/initiatives/'+initiative.id);
   await page.getByRole('region',{name:'Documents',exact:true}).getByRole('link',{name:initiativeDoc.title,exact:true}).waitFor();
   await proof('initiative-documents',width);
   await go('/app/settings#teams');
   const teamSummary=page.locator('summary').filter({hasText:name+' team'});
   await teamSummary.click();
   const teamCard=teamSummary.locator('..');
   await teamCard.getByRole('link',{name:'Team documents',exact:true}).waitFor();
   await proof('settings-team-documents-link',width);
   await teamCard.getByRole('link',{name:'Team documents',exact:true}).click();
   await page.getByRole('heading',{name:team.name,exact:true}).waitFor();
   await page.getByRole('region',{name:'Documents',exact:true}).getByRole('link',{name:teamDoc.title,exact:true}).waitFor();
   await proof('team-documents',width);
   await go('/app/search');
   await page.getByLabel('Search workspace',{exact:true}).fill(title);
   await page.getByRole('link',{name:title,exact:true}).waitFor();
   await proof('document-search',width);
   console.log('[PROJ-013] '+width+': UI project creation, two editor revisions, ordered history, issue specification, initiative/team lists, search, overflow, serious/critical axe and hydration PASS');
  }
 }finally{page.off('pageerror',pageError);page.off('console',consoleError);}
}
