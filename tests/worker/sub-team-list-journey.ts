import {env} from "cloudflare:workers";
import {expect} from "vitest";
import {roleWorkspace,resetLimits,snapshot} from "./role-fixture";
import {team} from "./sub-team-fixture";
export async function subTeamList() {
  const w = await roleWorkspace(),
    parent = w.team;
  const a = await team(w, "synthetic-vector-6010", "PAGEA", parent.id),
    b = await team(w, "synthetic-vector-6011", "PAGEB", parent.id);
  const own = await w.create({
      teamId: parent.id,
      title: "synthetic-vector-6012",
    }),
    expected = [own.identifier];
  // Real issue writes, crossing the bounded list page.
  for (let n = 0; n < 52; n++) {
    await resetLimits();
    const issue = await w.create({
      teamId: a.id,
      title: "synthetic-vector-" + (6100 + n),
    });
    expected.push(issue.identifier);
  }
  const hidden = await w.create({
    teamId: b.id,
    title: "synthetic-vector-6013",
  });
  expect(
    (
      await w.call(`/settings/teams/${b.id}/privacy`, "PUT", {
        isPrivate: true,
      })
    ).status,
  ).toBe(200);
  const read = (query: string) =>
    w.member.call("/issues?team=" + parent.id + query);
  expect(
    ((await (await read("")).json()) as any).issues.map(
      (i: any) => i.identifier,
    ),
  ).toEqual([own.identifier]);
  const first = (await (
    await read("&includeSubTeams=true&sort=oldest")
  ).json()) as any;
  expect(first.total).toBe(53);
  expect(first.issues).toHaveLength(50);
  expect(JSON.stringify(first)).not.toContain(hidden.identifier);
  const second = (await (
    await read(
      "&includeSubTeams=true&sort=oldest&offset=50&revision=" +
        encodeURIComponent(first.revision),
    )
  ).json()) as any;
  expect(second.issues).toHaveLength(3);
  expect(
    [...first.issues, ...second.issues].map((i: any) => i.identifier).sort(),
  ).toEqual(expected.sort());
  const api = (await (
    await w.member.api("/issues?team=" + parent.id + "&includeSubTeams=true")
  ).json()) as any;
  expect(api.total).toBe(53);
  const saved = await w.member.call("/preferences/issues", "PUT", {
    filters: { team: parent.id, includeSubTeams: "true" },
    sort: "oldest",
    grouping: "none",
  });
  expect(saved.status).toBe(200);
  const restored = (await (
    await w.member.call("/preferences/issues")
  ).json()) as any;
  expect(restored.filters.includeSubTeams).toBe("true");
  expect(
    (
      await w.call(`/settings/teams/${b.id}/members/${w.member.id}`, "PUT", {
        role: "member",
      })
    ).status,
  ).toBe(200);
  expect(
    ((await (await read("&includeSubTeams=true")).json()) as any).total,
  ).toBe(54);
  expect(
    (await w.call(`/settings/teams/${b.id}/members/${w.member.id}`, "DELETE"))
      .status,
  ).toBe(200);
  const withdrawn = (await (await read("&includeSubTeams=true")).json()) as any;
  expect(withdrawn.total).toBe(53);
  expect(JSON.stringify(withdrawn)).not.toContain(hidden.identifier);
  expect((await w.member.call("/issues/" + hidden.identifier)).status).toBe(
    404,
  );
  expect(
    ((await (await read("&includeSubTeams=false")).json()) as any).total,
  ).toBe(1);
}

