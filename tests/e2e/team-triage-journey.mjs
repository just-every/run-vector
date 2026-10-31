import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {navigate} from './collaboration-navigation.mjs';
import {openAdministrationForm} from './ui-administration-form.mjs';
import {roleScreens} from './role-ui-support.mjs';

export async function teamTriageSettings({page,runtime,evidence,team,other,send}) {
  const {base,sql}=runtime,inspect=roleScreens(evidence),path='/settings/teams/'+team.id;
  await page.setViewportSize({width:1440,height:1000});
  const pending=await send(page,'/intake','POST',{teamId:team.id,title:'synthetic-vector-2620',summary:'synthetic-vector-2621'},201);
  const independent=await send(page,'/intake','POST',{teamId:other.id,title:'synthetic-vector-2622'},201);
  const retained=()=>({issues:sql(`SELECT * FROM issues WHERE id='${pending.id}'`),evidence:sql(`SELECT * FROM evidence_revisions WHERE issue_id='${pending.id}'`),decisions:sql(`SELECT * FROM intake_decisions WHERE issue_id='${pending.id}'`)});
  const before=retained();
  const save=async enabled=>{
    await navigate(page,base+'/app/settings');const form=await openAdministrationForm(page,'Edit '+team.name);
    await form.getByLabel('Enable triage',{exact:true}).setChecked(enabled);
    const receipt=page.waitForResponse(response=>new URL(response.url()).pathname==='/api'+path&&response.request().method()==='PATCH');
    await form.getByRole('button',{name:'Save team',exact:true}).click();assert.equal((await receipt).status(),200);return form;
  };
  const form=await save(false);await inspect(page,form,'team-triage-disabled-settings');
  await page.reload();await openAdministrationForm(page,'Edit '+team.name);
  await expect(page.getByRole('form',{name:'Edit '+team.name,exact:true}).getByLabel('Enable triage',{exact:true})).not.toBeChecked();
  await navigate(page,base+'/app/issues/'+pending.identifier);
  await expect(page.getByRole('heading',{name:pending.title,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Accept and route work',exact:true})).toHaveCount(0);
  await inspect(page,page.locator('main'),'team-triage-disabled-editor');
  await navigate(page,base+'/app/new-issue');await page.getByLabel(/^Team/).selectOption(team.id);
  await expect(page.getByRole('radio',{name:/Intake/})).toHaveCount(0);
  await page.getByLabel(/^Team/).selectOption(other.id);await expect(page.getByRole('radio',{name:/Intake/})).toBeVisible();
  await navigate(page,base+'/app');
  await expect(page.locator('.stream-list [data-issue-identifier="'+pending.identifier+'"]')).toHaveCount(0);
  await expect(page.locator('.stream-list [data-issue-identifier="'+independent.identifier+'"]')).toBeVisible();
  await inspect(page,page.locator('main'),'team-triage-disabled-current');
  const bypass=await send(page,'/intake','POST',{teamId:team.id,title:'synthetic-vector-2623',summary:'synthetic-vector-2624'},201);
  assert.equal(bypass.status.category,'backlog');assert.equal(bypass.evidence[0].summary,'synthetic-vector-2624');
  assert.deepEqual(retained(),before);
  await save(true);await navigate(page,base+'/app');
  await expect(page.locator('.stream-list [data-issue-identifier="'+pending.identifier+'"]')).toBeVisible();
  assert.deepEqual(retained(),before);
}
