import { expect } from 'vitest';
import { roleWorkspace, resetLimits } from './role-fixture';

export async function duplicateBooleanJourney(f: Awaited<ReturnType<typeof roleWorkspace>>, privateTeam: { id: string }) {
  const owner = f.people.owner, marker = 'synthetic-vector-133-duplicates';
  const json = async (response: Response, status = 200): Promise<any> => {
    expect(response.status, await response.clone().text()).toBe(status); return response.json();
  };
  const make = (title: string, teamId = f.team.id) => owner.call('/issues', 'POST', { teamId, title: marker + title }).then(response => json(response, 201));
  const canonical = await make(' canonical'), duplicate = await make(' duplicate');
  const hidden = await make(' private', privateTeam.id), privateDuplicate = await make(' public duplicate of private');
  const marked = await json(await owner.call('/issues/' + duplicate.identifier + '/duplicate', 'POST', { expectedVersion: duplicate.version, canonicalIdentifier: canonical.identifier }));
  await json(await owner.call('/issues/' + privateDuplicate.identifier + '/duplicate', 'POST', { expectedVersion: privateDuplicate.version, canonicalIdentifier: hidden.identifier }));
  const ids = async (expression: string, who = f.member) => {
    await resetLimits();
    const data = await json(await who.call('/issues?' + new URLSearchParams({ q: marker, expression })));
    expect(data.total).toBe(data.issues.length);
    return data.issues.map((i: any) => i.identifier).sort();
  };
  expect(await ids('duplicateof=' + canonical.identifier)).toEqual([duplicate.identifier]);
  expect(await ids('duplicates=' + duplicate.identifier)).toEqual([canonical.identifier]);
  expect(await ids('NOT duplicateof=none')).toEqual([duplicate.identifier]);
  expect(await ids('duplicateof=' + hidden.identifier)).toEqual([]);
  await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${f.member.id}`, 'PUT', { role: 'member' }));
  expect(await ids('duplicateof=' + hidden.identifier)).toEqual([privateDuplicate.identifier]);
  expect(await ids('duplicates=' + privateDuplicate.identifier)).toEqual([hidden.identifier]);
  await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${f.member.id}`, 'DELETE'));
  expect(await ids('duplicateof=' + hidden.identifier)).toEqual([]);
  expect(await ids('duplicates=' + privateDuplicate.identifier)).toEqual([]);
  const expression = '(duplicateof=' + canonical.identifier + ' OR duplicates=' + duplicate.identifier + ')';
  const saved = await json(await f.member.call('/views', 'POST', { name: marker, query: { q: marker, expression } }), 201);
  expect((await json(await f.member.call('/views/' + saved.id))).query.expression).toBe(expression);
  expect(await ids(expression, f.guest)).toEqual([canonical.identifier, duplicate.identifier].sort());
  await json(await owner.call('/issues/' + duplicate.identifier + '/duplicate', 'POST', { expectedVersion: marked.version, canonicalIdentifier: null }));
  expect(await ids('duplicateof=' + canonical.identifier)).toEqual([]);
  expect(await ids('duplicates=' + duplicate.identifier)).toEqual([]);
  console.log('PROBE SEARCH-004 duplicate-relations: native duplicate set and clear -> exact forward and reverse filters; saved expression retained, private canonical membership fenced before and after withdrawal, Guest scoped');
}
