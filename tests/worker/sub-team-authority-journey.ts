import {env} from "cloudflare:workers";
import {expect} from "vitest";
import {roleWorkspace,resetLimits,snapshot} from "./role-fixture";
import {team,current,change} from "./sub-team-fixture";
export async function subTeamAuthority() {
  const w = await roleWorkspace(),
    parent = w.team;
  const a = await team(w, "synthetic-vector-6020", "PERMA", parent.id);
  const destination = await team(w, "synthetic-vector-6021", "PERMB");
  const tables = [
    "teams",
    "workflow_statuses",
    "issues",
    "audit_records",
    "team_members",
  ];
  for (const who of [w.lead, w.member, w.guest])
    expect(
      (
        await w.call(`/settings/teams/${a.id}/members/${who.id}`, "PUT", {
          role: who === w.lead ? "owner" : "member",
        })
      ).status,
    ).toBe(200);
  for (const who of [w.lead, w.member, w.guest])
    expect(
      (
        await w.call(
          `/settings/teams/${destination.id}/members/${who.id}`,
          "PUT",
          { role: who === w.lead ? "owner" : "member" },
        )
      ).status,
    ).toBe(200);
  const viewer = await w.fresh("member");
  expect(
    (
      await w.call(`/settings/teams/${a.id}/members/${viewer.id}`, "PUT", {
        role: "member",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await w.call(
        `/settings/teams/${destination.id}/members/${viewer.id}`,
        "PUT",
        { role: "member" },
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await w.call(`/settings/operators/${viewer.id}/role`, "PATCH", {
        role: "viewer",
        teamIds: [],
      })
    ).status,
  ).toBe(200);
  for (const parentSetting of ["team_owners", "all_members"] as const)
    for (const childSetting of ["team_owners", "all_members"] as const) {
      await resetLimits();
      expect(
        (
          await w.call(`/settings/teams/${parent.id}/permissions`, "PUT", {
            settings: parentSetting,
            planning: "team_owners",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await w.call(`/settings/teams/${destination.id}/permissions`, "PUT", {
            settings: parentSetting,
            planning: "team_owners",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await change(w, a.id, {
            permissionsInherited: false,
            settingsPermission: childSetting,
            planningPermission: "all_members",
          })
        ).status,
      ).toBe(200);
      for (const surface of ["call", "api"] as const)
        for (const who of [
          w.people.owner,
          w.admin,
          w.lead,
          w.member,
          w.guest,
          viewer,
        ]) {
          await resetLimits();
          const allowed =
            who === w.people.owner ||
            who === w.admin ||
            who === w.lead ||
            (who === w.member &&
              parentSetting === "all_members" &&
              childSetting === "all_members");
          const before = await snapshot(tables);
          const previous = await current(w, a.id);
          const res = await change(
            w,
            a.id,
            {
              workflowInherited: true,
              parentTeamId:
                previous.parentTeamId === parent.id
                  ? destination.id
                  : parent.id,
            },
            who,
            surface,
          );
          expect(res.status, await res.clone().text()).toBe(
            allowed ? 200 : 403,
          );
          if (!allowed) expect(await snapshot(tables)).toEqual(before);
        }
    }
  expect(
    (
      await change(w, a.id, {
        parentTeamId: parent.id,
        permissionsInherited: true,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await w.call(`/settings/teams/${parent.id}/permissions`, "PUT", {
        settings: "team_owners",
        planning: "all_members",
      })
    ).status,
  ).toBe(200);
  expect(await current(w, a.id)).toMatchObject({
    permissionsInherited: true,
    settingsPermission: "team_owners",
    planningPermission: "all_members",
  });
  expect(
    (
      await change(w, a.id, {
        permissionsInherited: false,
        settingsPermission: "all_members",
        planningPermission: "team_owners",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await w.call(`/settings/teams/${parent.id}/permissions`, "PUT", {
        settings: "all_members",
        planning: "all_members",
      })
    ).status,
  ).toBe(200);
  expect(await current(w, a.id)).toMatchObject({
    settingsPermission: "all_members",
    planningPermission: "team_owners",
  });
  let seq = 0;
  for (const allowed of [false, true]) {
    expect(
      (
        await w.call("/settings/teams/creation", "PUT", {
          membersMayCreate: allowed,
        })
      ).status,
    ).toBe(200);
    for (const surface of ["call", "api"] as const)
      for (const who of [w.member, w.guest, viewer]) {
        const prefix = "CRT" + String.fromCharCode(65 + seq++),
          before = await snapshot(tables);
        const res = await who[surface](
          surface === "call" ? "/settings/teams" : "/teams",
          "POST",
          {
            name: "synthetic-vector-" + (6200 + seq),
            identifierPrefix: prefix,
            parentTeamId: parent.id,
          },
        );
        const can = who === w.member && allowed;
        expect(res.status, await res.clone().text()).toBe(
          can ? (surface === "call" ? 200 : 201) : 403,
        );
        if (!can) expect(await snapshot(tables)).toEqual(before);
      }
  }
  expect(
    (
      await w.call(`/settings/teams/${parent.id}/permissions`, "PUT", {
        settings: "team_owners",
        planning: "all_members",
      })
    ).status,
  ).toBe(200);
  const before = await snapshot(tables);
  expect(
    (
      await w.member.api("/teams", "POST", {
        name: "synthetic-vector-6299",
        identifierPrefix: "CRTDENY",
        parentTeamId: parent.id,
      })
    ).status,
  ).toBe(403);
  expect(await snapshot(tables)).toEqual(before);
  const token = await env.DB.prepare(
    "SELECT token_id FROM vector_integration_tokens WHERE operator_id=?",
  )
    .bind(w.member.id)
    .first<string>("token_id");
  expect(
    (await w.member.call("/settings/integrations/tokens/" + token, "DELETE"))
      .status,
  ).toBe(200);
  const revoked = await snapshot(tables);
  expect(
    (await change(w, a.id, { workflowInherited: false }, w.member, "api"))
      .status,
  ).toBe(401);
  expect(await snapshot(tables)).toEqual(revoked);
}
