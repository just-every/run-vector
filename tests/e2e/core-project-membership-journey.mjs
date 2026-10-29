import { withOperatorClient } from './operator-request.mjs';
import {initiativesJourney} from './initiatives-journey.mjs';
import {releasesJourney} from './releases-journey.mjs';
import assert from 'node:assert/strict';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';
import { readDevelopmentLink } from './outbox-session.mjs';

export async function projectMembershipJourney(page, context, base, capture = async () => {}, state) {
  const api = async (path, method = 'GET', data) => {
    return withOperatorClient(context, async client => {
      const response = await client.fetch(base + '/api' + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
      assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
      return await response.json();
    });
  };
  const navigate = async path => {
    await beforePrivateNavigation(page, base + path);
    await page.goto(base + path);
  };
  const team = (await api('/settings/administration')).teams.find(t => !t.archivedAt);
  const email = `synthetic-vector-${Date.now()}@vector.test`;
  await api('/settings/operators/invite', 'POST', { email, displayName: 'Project lead', role: 'member' });
  const link = await readDevelopmentLink(base, context.request, email, state);
  // Like the owner context, never reuse a socket the local Worker closed after its 5 s idle lifetime.
  const memberContext = await context.browser().newContext({ storageState: await context.storageState(), extraHTTPHeaders: { Connection: 'close' } });
  try {
    const memberPage = await memberContext.newPage();
    await memberPage.goto(link);
    await memberPage.getByRole('button', { name: 'Confirm', exact: true }).click();
    await memberPage.waitForURL(base + '/app');
    const member = await (await memberContext.request.get(base + '/api/session')).json();
    assert.equal(member.role, 'member');
    const minted = await memberContext.request.post(base + '/api/settings/integrations/tokens', {
      headers: { Origin: base }, data: { name: `synthetic-vector-${Date.now()}`, scopes: ['projects:delete'] },
    });
    assert.equal(minted.status(), 201);
    const { token } = await minted.json();
    await contributingTeamsJourney({page, memberPage, memberContext, base, api, navigate, capture, memberId:member.operatorId});
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await memberPage.setViewportSize({ width, height: 1000 });
      const name = `Payment reliability ${width} ${Date.now()}`;
      const created = await api('/settings/projects', 'POST', { name, leadOperatorId: member.operatorId, description: 'Preserve every payment investigation when this rollout ends.' });
      const project = created.projects.find(p => p.name === name);
      const first = await api('/issues', 'POST', { title: 'Handle delayed payment confirmations', teamId: team.id, projectId: project.id });
      const second = await api('/issues', 'POST', { title: 'Explain settlement retries', teamId: team.id, projectId: project.id, description: 'Keep the settlement evidence.' });
      await beforePrivateNavigation(memberPage, base + '/app/projects/' + project.id);
      await memberPage.goto(base + '/app/projects/' + project.id);
      await memberPage.getByText('Manage ' + name, { exact: true }).click();
      assert(await memberPage.getByRole('button', { name: 'Delete project', exact: true }).isDisabled());
      await capture('PROJ-003', `member-project-deletion-disabled-${width}`, memberPage);
      for (const [path, headers] of [
        ['/api/settings/projects/', { Origin: base }],
        ['/api/v1/projects/', { Authorization: 'Bearer ' + token }],
      ]) {
        const denied = await memberContext.request.delete(base + path + project.id, { headers });
        assert.equal(denied.status(), 403, 'a Member lead cannot delete a project');
      }
      assert.equal((await api('/issues/' + second.identifier)).project.id, project.id);
      await beforePrivateNavigation(memberPage, base + '/app/issues/' + second.identifier);
      const memberSession = memberPage.waitForResponse(r => new URL(r.url()).pathname === '/api/session' && r.status() === 200);
      await memberPage.goto(base + '/app/issues/' + second.identifier);
      await memberPage.getByRole('heading', { name: second.title, exact: true }).waitFor();
      await memberSession;
      assert.equal(await memberPage.getByRole('button', { name: 'Delete issue', exact: true }).count(), 0);
      await capture('PROJ-003', `member-lead-deletion-denied-${width}`, memberPage);
      await navigate('/app/issues/' + first.identifier);
      const detached = page.waitForResponse(r => r.url() === base + '/api/issues/' + first.identifier && r.request().method() === 'PATCH');
      await page.getByLabel('Issue project', { exact: true }).selectOption('');
      assert.equal((await detached).status(), 200);
      assert.equal((await api('/issues/' + first.identifier)).project, null);
      await navigate('/app/projects/' + project.id);
      await page.getByText('Manage ' + name, { exact: true }).click();
      await page.getByRole('button', { name: 'Archive project', exact: true }).click();
      await page.getByRole('button', { name: 'Unarchive project', exact: true }).waitFor();
      assert.equal((await api('/issues/' + second.identifier)).project.id, project.id);
      await page.getByRole('button', { name: 'Delete project', exact: true }).click();
      await capture('PROJ-003', `confirm-delete-${width}`, page);
      await page.getByRole('button', { name: 'Cancel deletion', exact: true }).click();
      assert((await api('/settings/administration')).projects.some(p => p.id === project.id));
      await page.getByRole('button', { name: 'Delete project', exact: true }).click();
      await page.getByRole('button', { name: 'Delete project and keep issues', exact: true }).click();
      await page.waitForURL(base + '/app/projects');
      await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor();
      assert(!(await api('/settings/administration')).projects.some(p => p.id === project.id));
      await capture('PROJ-003', `deleted-portfolio-${width}`, page);
      for (const original of [first, second]) {
        const issue = await api('/issues/' + original.identifier);
        assert.equal(issue.id, original.id);
        assert.equal(issue.title, original.title);
        assert.equal(issue.project, null);
      }
      await navigate('/app/issues/' + second.identifier);
      await page.getByRole('heading', { name: second.title, exact: true }).waitFor();
      await page.getByRole('button', { name: 'Delete issue', exact: true }).waitFor();
      await page.getByText('Keep the settlement evidence.', { exact: true }).filter({visible:true}).first().waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture('PROJ-003', `retained-issue-${width}`, page);
    }
    await initiativesJourney({page,runtime:{base,state,req:(path,init={})=>fetch(base+path,init)},evidence:process.env.VECTOR_EVIDENCE_DIR??'.artifacts/verification/initiatives'});
    await releasesJourney({page,runtime:{base,state,req:(path,init={})=>fetch(base+path,init)},evidence:process.env.VECTOR_EVIDENCE_DIR??'.artifacts/verification/releases'});
  } finally {
    await memberContext.close();
  }
}


async function contributingTeamsJourney({page, memberPage, memberContext, base, api, navigate, capture, memberId}) {
  const suffix = String(Date.now());
  const letters = suffix.slice(-7).replaceAll(/\d/g, digit => String.fromCharCode(65+Number(digit)));
  const teams = [];
  for (const [index, isPrivate] of [false, true].entries()) {
    const name = 'synthetic-vector-'+(750+index)+'-'+suffix;
    teams.push((await api('/settings/teams','POST',{name,identifierPrefix:'P'+String.fromCharCode(65+index)+letters,isPrivate})).teams.find(team=>team.name===name));
  }
  const [publicTeam,privateTeam] = teams;
  const name = 'synthetic-vector-752-'+suffix;
  const project = (await api('/settings/projects','POST',{name,leadOperatorId:memberId})).projects.find(project=>project.name===name);
  const publicIssue = await api('/issues','POST',{title:'synthetic-vector-753',teamId:publicTeam.id,projectId:project.id});
  const privateIssue = await api('/issues','POST',{title:'synthetic-vector-754',teamId:privateTeam.id});
  await api('/issues/'+privateIssue.identifier,'PATCH',{expectedVersion:privateIssue.version,projectId:project.id});
  const memberApi = (path) => withOperatorClient(memberContext,async client=>{
    const response = await client.get(base+'/api'+path);
    assert.equal(response.status(),200); return response.json();
  });
  const goMember = async path => { await beforePrivateNavigation(memberPage,base+path); await memberPage.goto(base+path); };
  const screens = async (label,currentPage) => {
    for (const width of [1440,390]) {
      await currentPage.setViewportSize({width,height:1000});
      await capture('PROJ-014',label+'-'+width,currentPage);
    }
    await currentPage.setViewportSize({width:1440,height:1000});
  };
  await page.setViewportSize({width:1440,height:1000});
  await memberPage.setViewportSize({width:1440,height:1000});
  for (const team of teams) {
    await navigate('/app/teams/'+team.id);
    await page.getByRole('heading',{name:team.name,exact:true}).waitFor();
    const row = page.getByRole('region',{name:'Projects',exact:true}).getByRole('link',{name:'Open '+name,exact:true});
    await row.waitFor();
    const contribution = await row.locator('.project-row__teams').innerText();
    for (const contributor of teams) assert.ok(contribution.includes(contributor.name));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await screens('contributing-project-'+(team===publicTeam?'public':'private')+'-team',page);
    await row.click();
    await page.getByRole('heading',{name,exact:true}).waitFor();
    const detailTeams = await page.locator('.project-facts').innerText();
    for (const contributor of teams) assert.ok(detailTeams.includes(contributor.name));
    await page.locator('.project-facts').getByRole('link',{name:team.name,exact:true}).click();
    await page.getByRole('heading',{name:team.name,exact:true}).waitFor();
    await page.getByRole('region',{name:'Projects',exact:true}).getByRole('link',{name:'Open '+name,exact:true}).waitFor();
    await navigate('/app/projects/'+project.id);
    await page.getByRole('heading',{name,exact:true}).waitFor();
  }
  await screens('project-both-contributing-teams',page);
  const restricted = async label => {
    await goMember('/app/teams/'+publicTeam.id);
    const row = memberPage.getByRole('region',{name:'Projects',exact:true}).getByRole('link',{name:'Open '+name,exact:true});
    await row.waitFor();
    assert.ok((await row.innerText()).includes(publicTeam.name));
    assert.ok(!(await memberPage.locator('main').innerText()).includes(privateTeam.name));
    assert.deepEqual((await memberApi('/projects?team='+privateTeam.id)).projects,[]);
    const detail = await memberApi('/projects/'+project.id);
    assert.deepEqual(detail.teams,[{id:publicTeam.id,name:publicTeam.name}]);
    assert.deepEqual(detail.issues.map(issue=>issue.identifier),[publicIssue.identifier]);
    await screens(label+'-public-team',memberPage);
    await goMember('/app/teams/'+privateTeam.id);
    await memberPage.getByRole('heading',{name:'This page is out of reach',exact:true}).waitFor();
    assert.equal(await memberPage.getByRole('region',{name:'Projects',exact:true}).count(),0);
    assert.ok(!(await memberPage.locator('main').innerText()).includes(name));
    await screens(label+'-private-team-unavailable',memberPage);
  };
  await restricted('nonmember');
  await api('/settings/teams/'+privateTeam.id+'/members/'+memberId,'PUT',{role:'member'});
  await goMember('/app/teams/'+privateTeam.id);
  const granted = memberPage.getByRole('region',{name:'Projects',exact:true}).getByRole('link',{name:'Open '+name,exact:true});
  await granted.waitFor();
  for(const team of teams)assert.ok((await granted.innerText()).includes(team.name));
  await screens('member-private-team',memberPage);
  await api('/settings/teams/'+privateTeam.id+'/members/'+memberId,'DELETE');
  await restricted('withdrawn-member');
  console.log('[PROJ-014] two actual team project lists and contributor names; same Member session observes current private-team membership and withdrawal');
}
