import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

function localMinute(value, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Every fixture is created through the signed-in operator's ordinary API. */
export async function streamControlsFixture(context, base) {
  async function api(path, method = 'GET', data) {
    const response = await context.request.fetch(base + '/api' + path, {
      method, headers: { Origin: base }, ...(data === undefined ? {} : { data }),
    });
    assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
    return response.json();
  }
  const [options, initial] = await Promise.all([api('/options'), api('/settings/administration')]);
  const token = Array.from(randomBytes(4), value => String.fromCharCode(65 + value % 26)).join('');
  const teams = [];
  for (const suffix of ['A', 'B', 'C']) {
    const identifierPrefix = `SC${token}${suffix}`;
    const receipt = await api('/settings/teams', 'POST', {
      name: `Stream controls ${token} ${suffix}`, identifierPrefix,
    });
    const team = receipt.teams.find(row => row.identifierPrefix === identifierPrefix);
    assert.ok(team);
    teams.push(team);
  }
  const projectName = `Stream controls project ${token}`;
  const projects = await api('/settings/projects', 'POST', {
    name: projectName, leadOperatorId: options.operator.id,
  });
  const project = projects.projects.find(row => row.name === projectName);
  assert.ok(project);
  const timezone = initial.workspace.timezone;
  const now = Date.now(), cycles = [];
  for (const team of teams) {
    const name = `Active ${team.identifierPrefix}`;
    const receipt = await api('/settings/cycles', 'POST', {
      teamId: team.id, name,
      startsLocal: localMinute(new Date(now - 2 * 86400000), timezone),
      endsLocal: localMinute(new Date(now + 10 * 86400000), timezone), capacity: 10,
    });
    const cycle = receipt.cycles.find(row => row.teamId === team.id && row.name === name);
    assert.ok(cycle);
    cycles.push(cycle);
  }
  const status = (team, category) => {
    const row = team.statuses.find(row => row.category === category);
    assert.ok(row, `${team.name} has ${category}`);
    return row.id;
  };
  async function create(team, name, input = {}, category = 'started') {
    let issue = await api('/issues', 'POST', {
      teamId: team.id, statusId: status(team, 'started'),
      title: `${name} ${token}`, ...input,
    });
    if (category !== 'started') issue = await api('/issues/' + issue.identifier, 'PATCH', {
      expectedVersion: issue.version, statusId: status(team, category),
    });
    return issue;
  }
  const [a, b, c] = teams, operatorId = options.operator.id;
  const items = {};
  items.primary = await create(a, 'Project assigned work', {
    priority: 'medium', assigneeOperatorId: operatorId, projectId: project.id,
    cycleId: cycles[0].id, estimate: 3,
  });
  items.context = await create(a, 'Urgent unassigned work', { priority: 'urgent' });
  items.other = await create(b, 'Second team assigned work', {
    priority: 'low', assigneeOperatorId: operatorId, cycleId: cycles[1].id,
  });
  items.done = await create(a, 'Completed project work', {
    priority: 'high', assigneeOperatorId: operatorId, projectId: project.id,
    cycleId: cycles[0].id, estimate: 2,
  }, 'completed');
  items.countDone = await create(b, 'Completed counted work', {
    priority: 'high', cycleId: cycles[1].id, estimate: 2,
  }, 'completed');
  items.intake = await api('/intake', 'POST', { teamId: a.id, title: `Decision needed ${token}` });
  items.unrelated = await create(c, 'Unrelated cycle work', { cycleId: cycles[2].id, estimate: 1 });
  return { api, teams, project, cycles, timezone, operatorId, items, create, status };
}
