import assert from 'node:assert/strict';
import {inviteReader,readerApi} from './role-reader-support.mjs';
import {navigate} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';
export async function referenceAccessCells(page,runtime,evidence){
 const base=runtime.base,owner=readerApi(page,base),inspect=roleScreens(evidence),reader=await inviteReader({owner:page,browser:page.context().browser(),runtime,email:'synthetic-vector-1930@vector.test',name:'synthetic-vector-1930',role:'member'});
 try{
  const teams=(await owner('/settings/administration')).teams,publicTeam=teams.find(t=>!t.isPrivate&&!t.archivedAt);
  const privateTeam=(await owner('/settings/teams','POST',{name:'synthetic-vector-1931',identifierPrefix:'SYNREFR',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-1931');
  const target=await owner('/issues','POST',{teamId:publicTeam.id,title:'synthetic-vector-1932'},201);
  const source=await owner('/issues','POST',{teamId:privateTeam.id,title:'synthetic-vector-1933',description:'See '+target.identifier},201);
  const open=async()=>{await navigate(reader.page,base+'/app/issues/'+target.identifier);await reader.page.getByRole('heading',{name:target.title,exact:true}).waitFor();await reader.page.getByText('History',{exact:true}).click();};
  for(const width of [1440,390]){
   await reader.page.setViewportSize({width,height:width===390?844:1000});await open();assert.equal(await reader.page.getByRole('link',{name:'Mentioned in '+source.identifier,exact:true}).count(),0);assert.ok(!JSON.stringify(await reader.api('/issues/'+target.identifier)).includes(source.identifier));
  }
  await owner(`/settings/operators/${reader.id}/role`,'PATCH',{role:'viewer',teamIds:[]});await open();assert.equal(await reader.page.getByRole('link',{name:'Mentioned in '+source.identifier,exact:true}).count(),0);
  await owner(`/settings/teams/${privateTeam.id}/members/${reader.id}`,'PUT',{role:'member'});await open();await reader.page.getByRole('link',{name:'Mentioned in '+source.identifier,exact:true}).waitFor();
  await inspect(reader.page,reader.page.locator('.issue-history'),'reference-private-viewer');
  await reader.api('/issues/'+target.identifier,'PATCH',{expectedVersion:target.version,description:'synthetic-vector-1934'},403);
  await owner(`/settings/teams/${privateTeam.id}/members/${reader.id}`,'DELETE');await open();assert.equal(await reader.page.getByRole('link',{name:'Mentioned in '+source.identifier,exact:true}).count(),0);
  console.log('ISSUE-027 private-source backlinks follow current Member/Viewer membership at 1440/390');
 }finally{await reader.context.close();}
}
