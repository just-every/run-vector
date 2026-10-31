import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {navigate} from './collaboration-navigation.mjs';
import {openAdministrationForm} from './ui-administration-form.mjs';
import {openDisclosures} from './ui-controls-checks.mjs';
import {roleScreens} from './role-ui-support.mjs';

/** Reuse native Settings and issue editors, with Current's real projection. */
export async function teamEstimatesSettings({page,runtime,evidence,team,other,send}) {
  const {base,sql}=runtime,capture=roleScreens(evidence),inspect=async(actor,region,name)=>{await capture(actor,region,name);await actor.setViewportSize({width:1440,height:1000});},path='/settings/teams/'+team.id;
  await page.setViewportSize({width:1440,height:1000});
  const started=team.statuses.find(status=>status.category==='started').id;
  const issue=await send(page,'/issues','POST',{teamId:team.id,title:'synthetic-vector-2605',statusId:started,estimate:34},201);
  const independent=await send(page,'/issues','POST',{teamId:other.id,title:'synthetic-vector-2606',statusId:other.statuses.find(status=>status.category==='started').id,estimate:7},201);
  const save=async(scale,enabled=true)=>{
    await navigate(page,base+'/app/settings');
    const form=await openAdministrationForm(page,'Edit '+team.name);
    await form.getByLabel('Enable estimates',{exact:true}).setChecked(enabled);
    await form.getByLabel('Estimate scale',{exact:true}).selectOption(scale);
    const receipt=page.waitForResponse(response=>new URL(response.url()).pathname==='/api'+path&&response.request().method()==='PATCH');
    await form.getByRole('button',{name:'Save team',exact:true}).click();
    assert.equal((await receipt).status(),200);
    return form;
  };
  const retained=()=>sql(`SELECT * FROM cycle_snapshots WHERE cycle_id IN(SELECT id FROM cycles WHERE team_id='${team.id}') ORDER BY cycle_id`);
  const history=retained();
  const form=await save('tshirt');
  await inspect(page,form,'team-estimates-tshirt-settings');
  await page.reload();await openAdministrationForm(page,'Edit '+team.name);
  await expect(page.getByRole('form',{name:'Edit '+team.name,exact:true}).getByLabel('Estimate scale',{exact:true})).toHaveValue('tshirt');
  for(const [scale,value,label] of [['tshirt','5','L (5 points)'],['fibonacci','21','21 points'],['exponential','32','32 points']]) {
    if(scale!=='tshirt')await save(scale);
    await navigate(page,base+'/app/issues/'+issue.identifier);
    await page.getByRole('button',{name:'Edit estimate',exact:true}).click();
    const estimate=page.getByRole('combobox',{name:'Issue estimate',exact:true});
    await expect(estimate).toBeVisible();
    await estimate.selectOption(value);
    const receipt=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/issues/'+issue.identifier&&response.request().method()==='PATCH');
    await page.getByRole('button',{name:'Save estimate',exact:true}).click();assert.equal((await receipt).status(),200);
    await expect(page.getByText('Estimate: '+label,{exact:true})).toBeVisible();
    if(scale==='tshirt')await inspect(page,page.locator('main'),'team-estimates-tshirt-editor');
    await navigate(page,base+'/app');
    const row=page.locator('.stream-list [data-issue-identifier="'+issue.identifier+'"]');
    await expect(row.getByLabel('Estimate',{exact:true})).toHaveText(label);
    if(scale==='tshirt')await inspect(page,page.locator('main'),'team-estimates-tshirt-current');
  }
  await navigate(page,base+'/app/new-issue');
  await page.getByLabel(/^Team/).selectOption(team.id);await openDisclosures(page);
  await expect(page.getByRole('combobox',{name:'Estimate',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Estimate',exact:true}).locator('option[value="32"]')).toHaveText('32 points');
  await save('exponential',false);
  await navigate(page,base+'/app/issues/'+issue.identifier);
  await expect(page.getByRole('button',{name:'Edit estimate',exact:true})).toHaveCount(0);
  await inspect(page,page.locator('main'),'team-estimates-disabled-editor');
  await navigate(page,base+'/app/new-issue');await page.getByLabel(/^Team/).selectOption(team.id);await openDisclosures(page);
  await expect(page.getByLabel('Estimate',{exact:true})).toHaveCount(0);
  await page.getByLabel(/^Team/).selectOption(other.id);
  await expect(page.getByLabel('Estimate',{exact:true})).toBeVisible();
  await navigate(page,base+'/app');
  await expect(page.locator('.stream-list [data-issue-identifier="'+issue.identifier+'"]').getByLabel('Estimate',{exact:true})).toHaveCount(0);
  await expect(page.locator('.stream-list [data-issue-identifier="'+independent.identifier+'"]').getByLabel('Estimate',{exact:true})).toHaveText('7 points');
  await inspect(page,page.locator('main'),'team-estimates-disabled-current');
  await navigate(page,base+'/app/issues');
  await page.locator('#issue-row-'+independent.identifier).focus();await page.keyboard.press('e');
  const keyboard=page.getByRole('dialog',{name:'Change estimate',exact:true});
  await expect(keyboard.getByLabel('Estimate',{exact:true})).toBeFocused();
  await expect(keyboard.getByLabel('Estimate',{exact:true})).toHaveValue('7');
  await page.keyboard.press('Escape');

  assert.equal(sql(`SELECT estimate FROM issues WHERE id='${issue.id}'`)[0].estimate,32);
  await save('tshirt');await navigate(page,base+'/app/issues/'+issue.identifier);
  await expect(page.getByText('Estimate: 32 points (retained)',{exact:true})).toBeVisible();
  assert.deepEqual(retained(),history,'feature and scale changes preserve closed snapshots');
}
