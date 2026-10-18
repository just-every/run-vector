import { expect, it } from "vitest";
import { setupAdministration } from "./administration-fixture";
import { invite, request } from "./base-auth-fixture";

async function fixture() {
  const f = await setupAdministration(),
    prefix =
      "MO" +
      crypto
        .randomUUID()
        .slice(0, 6)
        .toUpperCase()
        .replace(/\d/g, (d) => String.fromCharCode(65 + Number(d)));
  const state = await f.mutate("/settings/teams", "POST", {
      name: "Manual order " + prefix,
      identifierPrefix: prefix,
    }),
    team = state.teams.find((t) => t.identifierPrefix === prefix)!;
  return {
    ...f,
    team,
    create: (extra: Record<string, unknown> = {}) =>
      f.create({ teamId: team.id, ...extra }),
  };
}
async function receipt<T>(response: Response, status = 200): Promise<T> {
  expect(response.status, await response.clone().text()).toBe(status);
  return response.json() as Promise<T>;
}
type OrderState = { version: number };
type Listed = { revision: string; issues: { identifier: string }[] };
type Current = { sections: Record<string, { identifier: string }[]> };
const identifiers = (list: Listed) =>
  list.issues.map((issue) => issue.identifier);
const currentOrder = (current: Current) =>
  Object.fromEntries(
    Object.entries(current.sections).map(([key, issues]) => [
      key,
      issues.map((issue) => issue.identifier),
    ]),
  );

it("[VIEW-006 CURR-007] keyboard order persists for another session while issue history and Current ranking stay unchanged", async () => {
  const f = await fixture(),
    team = f.team;
  const otherCookie = await invite(
    `planner-${crypto.randomUUID()}@order.test`,
    f.cookie,
  );
  const [first, second, third] = await Promise.all([
    f.create({ title: "First backlog issue" }),
    f.create({ title: "Second backlog issue" }),
    f.create({ title: "Third backlog issue" }),
  ]);
  const started = team.statuses.find(
    (status) => status.category === "started",
  )!;
  await f.create({ title: "Current ranking one", statusId: started.id });
  await f.create({ title: "Current ranking two", statusId: started.id });
  const listPath = `/issues?team=${team.id}&category=backlog&sort=manual`;
  const read = async () => receipt<Listed>(await f.call(listPath));
  const initial = await read(),
    original = identifiers(initial);
  expect(original).toHaveLength(3);
  const beforeCurrent = currentOrder(
    await receipt<Current>(await f.call("/current")),
  );
  const beforeIssue = await receipt(
    await f.call(`/issues/${third.identifier}`),
  );
  const state = await receipt<OrderState>(
    await f.call(`/issues/order?teamId=${team.id}`),
  );
  const top = await receipt<OrderState>(
    await f.call("/issues/order", "POST", {
      teamId: team.id,
      identifier: third.identifier,
      action: "top",
      expectedVersion: state.version,
    }),
  );
  const moved = await read();
  expect(identifiers(moved)).toEqual([
    third.identifier,
    ...original.filter((id) => id !== third.identifier),
  ]);
  expect(moved.revision).not.toBe(initial.revision);
  const secondSession = await receipt<Listed>(
    await request("/api" + listPath, "GET", undefined, otherCookie),
  );
  expect(identifiers(secondSession)).toEqual(identifiers(moved));
  expect(await receipt(await f.call(`/issues/${third.identifier}`))).toEqual(
    beforeIssue,
  );
  expect(
    currentOrder(await receipt<Current>(await f.call("/current"))),
  ).toEqual(beforeCurrent);
  const stale = await f.call("/issues/order", "POST", {
    teamId: team.id,
    identifier: first.identifier,
    action: "down",
    expectedVersion: state.version,
  });
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({
    error: "stale_version",
    version: top.version,
  });
  expect(identifiers(await read())).toEqual(identifiers(moved));
  const down = await receipt<OrderState>(
    await f.call("/issues/order", "POST", {
      teamId: team.id,
      identifier: third.identifier,
      action: "down",
      expectedVersion: top.version,
    }),
  );
  const downOrder = identifiers(await read());
  expect(downOrder[1]).toBe(third.identifier);
  await receipt<OrderState>(
    await f.call("/issues/order", "POST", {
      teamId: team.id,
      identifier: third.identifier,
      action: "up",
      expectedVersion: down.version,
    }),
  );
  expect(identifiers(await read())[0]).toBe(third.identifier);
  expect(new Set(identifiers(await read()))).toEqual(
    new Set([first.identifier, second.identifier, third.identifier]),
  );
});

it("[VIEW-006 VIEW-003] shared-view members reorder an isolated sequence and foreign subjects and anchors are refused", async () => {
  const f = await fixture(),
    team = f.team;
  const memberCookie = await invite(
    `member-${crypto.randomUUID()}@order.test`,
    f.cookie,
  );
  const first = await f.create({ title: "Scope first" }),
    second = await f.create({ title: "Scope second" });
  const administration = await f.mutate("/settings/teams", "POST", {
    name: "Other order scope",
    identifierPrefix: "ORDER",
  });
  const other = administration.teams.find(
    (candidate) => candidate.id !== team.id,
  )!;
  const foreign = await f.create({
    title: "Another team's issue",
    teamId: other.id,
  });
  const view = await receipt<{ id: string }>(
    await f.call("/views", "POST", {
      name: "Shared planning",
      isShared: true,
      query: { team: team.id, sort: "manual" },
    }),
    201,
  );
  const privateView = await receipt<{ id: string }>(
    await f.call("/views", "POST", {
      name: "Private planning",
      query: { team: team.id, sort: "manual" },
    }),
    201,
  );
  const member = (path: string, method = "GET", body?: unknown) =>
    request("/api" + path, method, body, memberCookie);
  const state = await receipt<OrderState>(
    await member(`/issues/order?viewId=${view.id}`),
  );
  const accepted = await receipt<OrderState>(
    await member("/issues/order", "POST", {
      viewId: view.id,
      identifier: second.identifier,
      action: "before",
      anchor: first.identifier,
      expectedVersion: state.version,
    }),
  );
  const viewPath = `/issues?team=${team.id}&sort=manual&orderView=${view.id}`;
  expect(identifiers(await receipt<Listed>(await f.call(viewPath)))).toEqual([
    second.identifier,
    first.identifier,
  ]);
  expect(
    identifiers(
      await receipt<Listed>(
        await f.call(`/issues?team=${team.id}&sort=manual`),
      ),
    ),
  ).toEqual([first.identifier, second.identifier]);
  expect((await member(`/issues/order?viewId=${privateView.id}`)).status).toBe(
    404,
  );
  for (const input of [
    { viewId: view.id, identifier: foreign.identifier, action: "top" },
    {
      viewId: view.id,
      identifier: first.identifier,
      action: "after",
      anchor: foreign.identifier,
    },
    { teamId: other.id, identifier: first.identifier, action: "top" },
    { viewId: privateView.id, identifier: first.identifier, action: "top" },
  ])
    expect(
      (
        await member("/issues/order", "POST", {
          ...input,
          expectedVersion: input.viewId === view.id ? accepted.version : 0,
        })
      ).status,
    ).toBe(404);
  expect(identifiers(await receipt<Listed>(await f.call(viewPath)))).toEqual([
    second.identifier,
    first.identifier,
  ]);
  expect(
    await receipt<OrderState>(await member(`/issues/order?viewId=${view.id}`)),
  ).toEqual(accepted);
});
