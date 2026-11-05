import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { expect } from "@playwright/test";
import { navigate, settleReads } from "./collaboration-navigation.mjs";
import { openTeam } from "./settings-pane-support.mjs";
import { roleScreens } from "./role-ui-support.mjs";

/**
 * TRIAGE-002's selected Sentry slice through ordinary doors: ordered team and workspace rules in Settings, a signed
 * Sentry issue through the real receiver (sentry.io is faked only at the Worker's network edge), and the acting rule
 * with its saved revision on the routed item, in its issue page and in Current. The Worker journey keeps the full
 * custody, replay, rollback and authority matrix; this proves what a person sees and does. It extends the
 * administration runtime's existing registration rather than adding one (the seed is at its test cap).
 */
export async function triageRoutingJourney({ page, runtime, evidence, peer, memberId }) {
  const { base, sql } = runtime, capture = roleScreens(evidence), ownerName = runtime.config.FIRST_OWNER_NAME, prior = page.viewportSize();
  // Each screen is inspected at 1440 and 390; the journey itself runs at 1440.
  const inspect = async (region, name) => { await capture(page, region, name); await page.setViewportSize({ width: 1440, height: 1000 }); };
  const send = async (actor, path, method = "GET", data, status = 200) => {
    const response = await actor.request.fetch(base + "/api" + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
    assert.equal(response.status(), status, method + " " + path + " " + await response.text());
    return response.json();
  };
  const team = async (name, identifierPrefix) => (await send(page, "/settings/teams", "POST", { name, identifierPrefix })).teams.find(t => t.identifierPrefix === identifierPrefix);
  const origin = await team("Signal delivery", "SYNSIG"), incidents = await team("Routed incidents", "SYNRTE"), escalations = await team("Escalations desk", "SYNESC");
  const secret = "synthetic-vector-9342", teamPath = `/settings/teams/${origin.id}/triage-routing`;
  // The network edge accepts this synthetic Sentry token for the latest-event read.
  await send(page, "/settings/integrations/errors", "POST", { provider: "sentry", teamId: origin.id, regressionRule: "reopen", token: "synthetic-vector-8201", secret }, 201);
  const deliver = async (record) => {
    const body = JSON.stringify({ action: "created", data: { issue: { id: record, title: "synthetic-vector-" + record, lastSeen: new Date().toISOString(),
      permalink: `https://sentry.io/organizations/synthetic-vector/issues/${record}/`, count: "3", userCount: 1, substatus: "ongoing", metadata: { value: "synthetic-vector-" + record } } } });
    const response = await fetch(base + "/api/integrations/errors/sentry/" + origin.id, { method: "POST", body, headers: { "Content-Type": "application/json",
      "Sentry-Hook-Signature": createHmac("sha256", secret).update(body).digest("hex"), "Sentry-Hook-Resource": "issue", "Request-ID": "synthetic-vector-" + record + "-1" } });
    assert.equal(response.status, 200, await response.clone().text());
    const { identifier } = await response.json(), [row] = sql(`SELECT team_id,triage_route_json FROM issues WHERE identifier='${identifier}'`);
    return { identifier, teamId: row.team_id, route: JSON.parse(row.triage_route_json ?? "null") };
  };
  const stored = () => ({ configs: sql("SELECT * FROM triage_routing_configs ORDER BY scope_key"), audit: sql("SELECT * FROM audit_records ORDER BY id") });
  const routed = (scope, rule, revision, by = ownerName) => `Routed by ${scope} rule “${rule}” · revision ${revision} · saved by ${by}`;
  const region = (actor) => actor.getByRole("region", { name: `Intake routing for ${origin.name}`, exact: true });
  const saved = (actor, path = teamPath) => actor.waitForResponse(r => new URL(r.url()).pathname === "/api" + path && r.request().method() === "PUT");
  const addRule = async (scope, name, destination, path = teamPath) => {
    await scope.getByRole("button", { name: "Add routing rule", exact: true }).click();
    const form = scope.getByRole("form", { name: /^New (workspace )?routing rule/ });
    await form.getByLabel("Rule name", { exact: true }).fill(name);
    await form.getByLabel("Destination team", { exact: true }).selectOption(destination.id);
    const receipt = saved(page, path);
    await form.getByRole("button", { name: "Add rule", exact: true }).click();
    assert.equal((await receipt).status(), 200);
    await expect(form).toHaveCount(0);
  };
  const ruleNames = async (scope) => (await scope.locator(".status-row .status-name").allTextContents());
  {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openTeam(page, base, origin, "automation");
    const rules = region(page);
    await expect(rules.getByRole("button", { name: "Add routing rule", exact: true })).toBeEnabled();
    await addRule(rules, "Sentry incidents", incidents);
    await addRule(rules, "Escalations", escalations);
    await expect(rules.getByText("Sentry · Signal delivery → Escalations desk", { exact: true })).toBeVisible();
    assert.deepEqual(await ruleNames(rules), ["Sentry incidents", "Escalations"]);
    // Keyboard order: the handle's arrow key stores the new order at once, against the saved revision.
    const handle = rules.getByRole("button", { name: "Reorder Escalations", exact: true });
    await handle.focus();
    await expect(page.getByRole("tooltip", { name: "Drag to reorder", exact: true })).toBeVisible();
    const reordered = saved(page);
    await page.keyboard.press("ArrowUp");
    assert.equal((await reordered).status(), 200);
    await expect(rules.getByText(`Revision 3 · saved by ${ownerName}`, { exact: true })).toBeVisible();
    await settleReads(page);
    await page.reload();
    await expect(region(page).getByRole("button", { name: "Add routing rule", exact: true })).toBeEnabled();
    assert.deepEqual(await ruleNames(region(page)), ["Escalations", "Sentry incidents"], "order persists through reload and hydration");
    await inspect(region(page), "triage-routing-team-rules");
    // A new signed Sentry issue follows the first matching rule, inside the same receiver transaction.
    const first = await deliver("9344");
    assert.equal(first.teamId, escalations.id);
    assert.deepEqual([first.route.ruleName, first.route.revision, first.route.scope], ["Escalations", 3, "team"]);
    await navigate(page, base + "/app/issues/" + first.identifier);
    await expect(page.getByText(routed("team", "Escalations", 3), { exact: true })).toBeVisible();
    await inspect(page.locator("main"), "triage-routing-routed-issue");
    await navigate(page, base + "/app/current/" + first.identifier);
    const detail = page.getByRole("region", { name: "Issue detail", exact: true });
    await expect(detail.getByText(routed("team", "Escalations", 3), { exact: true })).toBeVisible();
    await inspect(page.locator("main"), "triage-routing-current");
    // Changing a rule's team keeps placed items where they are; the next issue follows the new revision.
    await openTeam(page, base, origin, "automation");
    await region(page).getByRole("button", { name: "Actions for Escalations", exact: true }).click();
    await page.getByRole("menuitem", { name: "Change team", exact: true }).click();
    const retargeted = saved(page);
    await region(page).getByLabel("Team for Escalations", { exact: true }).selectOption(incidents.id);
    assert.equal((await retargeted).status(), 200);
    await region(page).getByRole("button", { name: "Done", exact: true }).click();
    const second = await deliver("9345");
    assert.deepEqual([second.teamId, second.route.ruleName, second.route.revision], [incidents.id, "Escalations", 4]);
    assert.equal(sql(`SELECT team_id FROM issues WHERE identifier='${first.identifier}'`)[0].team_id, escalations.id);
    // Workspace rules precede the team's own; removing one returns later issues to the team rules.
    await navigate(page, base + "/app/settings/workspace");
    const workspace = page.getByRole("region", { name: "Workspace intake routing", exact: true });
    await addRule(workspace, "Workspace triage", escalations, "/settings/triage-routing");
    await inspect(workspace, "triage-routing-workspace-rules");
    const third = await deliver("9346");
    assert.deepEqual([third.teamId, third.route.scope, third.route.revision], [escalations.id, "workspace", 1]);
    await navigate(page, base + "/app/issues/" + third.identifier);
    await expect(page.getByText(routed("workspace", "Workspace triage", 1), { exact: true })).toBeVisible();
    await navigate(page, base + "/app/settings/workspace");
    await workspace.getByRole("button", { name: "Actions for Workspace triage", exact: true }).click();
    await page.getByRole("menuitem", { name: "Remove…", exact: true }).click();
    const removed = saved(page, "/settings/triage-routing");
    await workspace.getByRole("button", { name: "Remove rule", exact: true }).click();
    assert.equal((await removed).status(), 200);
    assert.equal((await deliver("9347")).route.scope, "team");
    // Default permission: a non-owner Member has no Automation tab and the door refuses, storing nothing.
    await send(page, `/settings/teams/${origin.id}/members/${memberId}`, "PUT", { role: "member" });
    const current = await send(page, teamPath);
    await openTeam(peer, base, origin, "details");
    await expect(peer.getByRole("navigation", { name: "Team sections", exact: true }).getByRole("link", { name: "Automation", exact: true })).toHaveCount(0);
    let before = stored();
    await send(peer, teamPath, "PUT", { expectedVersion: current.version, rules: [] }, 403);
    assert.deepEqual(stored(), before, "Member refusal stores nothing");
    // All team members: the same Member renames a rule in the tab; their name is then on the revision.
    await send(page, `/settings/teams/${origin.id}/permissions`, "PUT", { settings: "all_members", planning: "all_members" });
    await openTeam(peer, base, origin, "automation");
    await region(peer).getByRole("button", { name: "Actions for Sentry incidents", exact: true }).click();
    await peer.getByRole("menuitem", { name: "Rename", exact: true }).click();
    const renamed = saved(peer);
    await region(peer).getByLabel("Rule name Sentry incidents", { exact: true }).fill("Customer incidents");
    await peer.keyboard.press("Enter");
    assert.equal((await renamed).status(), 200);
    const memberName = sql(`SELECT name FROM operators WHERE id='${memberId}'`)[0].name;
    await expect(region(peer).getByText(`Revision ${current.version + 1} · saved by ${memberName}`, { exact: true })).toBeVisible();
    await settleReads(peer);
    await navigate(peer, base + "/app");
    await send(page, `/settings/teams/${origin.id}/permissions`, "PUT", { settings: "team_owners", planning: "all_members" });
    before = stored();
    await send(peer, teamPath, "PUT", { expectedVersion: current.version + 1, rules: [] }, 403);
    assert.deepEqual(stored(), before, "withdrawn permission refuses the next request");
  }
  if (prior) await page.setViewportSize(prior);
  console.log("TRIAGE-002 ordered team and workspace Sentry routing rules, a signed Sentry issue through the receiver, and its acting rule and revision on the issue page and in Current passed; screens at 1440 and 390.");
}
