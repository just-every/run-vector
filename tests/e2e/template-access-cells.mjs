import assert from 'node:assert/strict';
import {inviteReader,readerApi} from './role-reader-support.mjs';
import {navigate} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';
export async function projectTemplateAccessCells(page,runtime,evidence){
 const base=runtime.base,owner=readerApi(page,base),browser=page.context().browser(),inspect=roleScreens(evidence);
 const reader=await inviteReader({owner:page,browser,runtime,email:'synthetic-vector-1920@vector.test',name:'synthetic-vector-1920',role:'member'});
 try{
  const team=(await owner('/settings/teams','POST',{name:'synthetic-vector-1921',identifierPrefix:'SYNTMPR',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-1921');
  const hidden=await owner('/project-templates','POST',{name:'synthetic-vector-1922',teamId:team.id,issues:[{title:'synthetic-vector-1923',offsetDays:null,milestonePosition:null}]},201);
  const visible=await owner('/project-templates','POST',{name:'synthetic-vector-1924',issues:[]},201);
  await reader.api('/project-templates/'+hidden.id,'GET',undefined,404);
  assert.ok(!(await reader.api('/project-templates')).templates.some(t=>t.id===hidden.id));
  await owner(`/settings/teams/${team.id}/members/${reader.id}`,'PUT',{role:'member'});
  await reader.api('/project-templates/'+hidden.id);
  for(const width of [1440,390]){
   await reader.page.setViewportSize({width,height:width===390?844:1000});await navigate(reader.page,base+'/app/projects');
   await reader.page.getByRole('button',{name:'New project from template',exact:true}).click();await reader.page.locator('[data-project-templates-ready="true"]').waitFor();
   await reader.page.getByLabel('Choose project template',{exact:true}).selectOption(hidden.id);await reader.page.getByText('Preview project structure',{exact:true}).click();
   await reader.page.getByText(/^synthetic-vector-1923 ·/).waitFor();
  }
  await inspect(reader.page,reader.page.locator('main:visible').first(),'template-private-member');
  await owner(`/settings/operators/${reader.id}/role`,'PATCH',{role:'viewer',teamIds:[team.id]});
  await reader.api('/project-templates/'+hidden.id);await reader.api('/project-templates/'+visible.id);
  for(const [path,method,data] of [
   ['/project-templates','POST',{name:'synthetic-vector-1925',issues:[]}],
   ['/project-templates/'+hidden.id,'PUT',{name:'synthetic-vector-1926',expectedVersion:hidden.version}],
   ['/project-templates/'+hidden.id+'/apply','POST',{name:'synthetic-vector-1927',startDate:'2026-11-01',teamId:team.id,expectedVersion:hidden.version}],
  ])await reader.api(path,method,data,403);
  await navigate(reader.page,base+'/app/projects');await reader.page.getByRole('heading',{name:'Projects',exact:true,level:1}).waitFor();assert.equal(await reader.page.getByRole('button',{name:'New project from template',exact:true}).count(),0);
  await inspect(reader.page,reader.page.locator('main:visible').first(),'template-viewer-refused-creation');
  console.log('PROJ-012 private team-template reads and Viewer creation/edit/application refusals passed at 1440/390');
 }finally{await reader.context.close();}
}
