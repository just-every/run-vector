import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforePrivateNavigation, settleReads } from "./collaboration-navigation.mjs";
import { poll } from "./admin-runtime-support.mjs";
const require = createRequire(import.meta.url);

/** Serious/critical axe findings inside `selector`, and horizontal overflow at both widths. */
async function inspect(page, selector, name, evidence) {
  await settleReads(page);
  const source = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  await page.evaluate((code) => {
    const script = document.createElement("script");
    const nonce = document.querySelector("script[nonce]")?.nonce;
    if (nonce) script.nonce = nonce;
    script.textContent = code;
    document.head.append(script);
  }, source);
  const findings = await page.evaluate(async (scope) => (await window.axe.run(scope)).violations
    .filter((violation) => ["serious", "critical"].includes(violation.impact))
    .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) })), selector);
  assert.deepEqual(findings, [], name + ": no serious or critical accessibility findings");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(geometry.document <= geometry.width, `${name} at ${width}: no horizontal overflow`);
    await page.screenshot({ path: resolve(evidence, `field-001-${name}-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

/** FIELD-001 through the browser: a team owner defines Severity in team Settings,
 * sets it on an issue from the property bar and renames an option by keyboard;
 * the stored value keeps its option identity and the history names it. */
export async function severityFieldJourney({ page, runtime, capture, clause, team, issue, evidence }) {
  const { base, sql } = runtime;
  const fields = base + `/app/settings/teams/${team.id}/fields`, detail = base + "/app/issues/" + issue.identifier;
  await clause("FIELD-001", "team Severity field defined in Settings, set from the issue and renamed without moving its stored value", async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await beforePrivateNavigation(page, fields);
    await page.goto(fields);
    await page.getByRole("link", { name: "Fields", exact: true }).and(page.locator('[aria-current="page"]')).waitFor();
    await page.getByRole("button", { name: "Add field", exact: true }).click();
    const teamName = sql(`SELECT name FROM teams WHERE id='${team.id}'`)[0].name;
    const form = page.getByRole("form", { name: `Add field to ${teamName}`, exact: true });
    await form.getByLabel("Name", { exact: true }).fill("Severity");
    await form.getByLabel("Description (optional)", { exact: true }).fill("How badly the problem hurts");
    for (const [index, name] of ["Minor", "Major", "Critical"].entries())
      await form.getByLabel(`Option ${index + 1}`, { exact: true }).fill(name);
    const created = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/settings/teams/${team.id}/custom-fields` && response.request().method() === "POST");
    await form.getByRole("button", { name: "Add field", exact: true }).click();
    assert.equal((await created).status(), 200);
    const [field] = await poll(() => sql(`SELECT * FROM custom_field_definitions WHERE team_id='${team.id}' AND name='Severity'`), (rows) => rows.length === 1, "Severity definition");
    const options = sql(`SELECT * FROM custom_field_options WHERE field_id='${field.id}' ORDER BY position`);
    assert.deepEqual(options.map((option) => option.name), ["Minor", "Major", "Critical"]);
    const major = options[1].id;
    await page.getByRole("list", { name: "Severity options", exact: true }).getByText("Critical", { exact: true }).waitFor();
    await capture("field-001-settings-created");
    await inspect(page, ".team-fields", "settings-fields", evidence);

    // The issue's property bar offers the team's field; one change is one attributed entry.
    await beforePrivateNavigation(page, detail);
    await page.goto(detail);
    await page.getByRole("heading", { name: issue.title, exact: true }).waitFor();
    const picker = page.locator(".issue-property-bar").getByLabel("Issue Severity", { exact: true });
    await page.waitForFunction(() => document.querySelector('.issue-property-bar select[aria-label="Issue Severity"]')?.disabled === false);
    const before = sql(`SELECT * FROM issues WHERE id='${issue.id}'`)[0];
    await picker.focus();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Issue Severity", "the field takes keyboard focus");
    await picker.selectOption(major);
    const [stored] = await poll(() => sql(`SELECT * FROM issues WHERE id='${issue.id}'`),
      (rows) => JSON.parse(rows[0].custom_fields_json)[field.id] === major && rows[0].version === before.version + 1, "browser Severity value");
    assert.deepEqual({ ...JSON.parse(stored.custom_fields_json), [field.id]: undefined }, { ...JSON.parse(before.custom_fields_json), [field.id]: undefined }, "other custom-field keys unchanged");
    const history = sql(`SELECT * FROM issue_activity WHERE issue_id='${issue.id}' AND kind='issue.updated' ORDER BY rowid`).filter((row) => row.next_value_json.includes(field.id));
    assert.equal(history.length, 1, "one activity entry for one change");
    assert.ok(history[0].actor_operator_id, "the entry is attributed");
    assert.equal(JSON.parse(history[0].previous_value_json).customFields[field.id], undefined);
    assert.equal(JSON.parse(history[0].next_value_json).customFields[field.id], major);
    await page.locator("details.issue-history > summary").click();
    await page.getByText("Severity: None → Major", { exact: true }).waitFor();
    await capture("field-001-issue-set");

    // Rename by keyboard: the option keeps its identity, so the issue does not change.
    await beforePrivateNavigation(page, fields);
    await page.goto(fields);
    const trigger = page.getByRole("button", { name: "Actions for Major", exact: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Rename", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Rename", "the menu opens on its first action");
    await page.keyboard.press("Enter");
    await page.getByRole("textbox", { name: "Option name Major", exact: true }).waitFor();
    await page.keyboard.type("Serious");
    const renamed = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/settings/teams/${team.id}/custom-fields/${field.id}` && response.request().method() === "PATCH");
    await page.keyboard.press("Enter");
    assert.equal((await renamed).status(), 200);
    await page.getByRole("list", { name: "Severity options", exact: true }).getByText("Serious", { exact: true }).waitFor();
    assert.deepEqual(sql(`SELECT id,name FROM custom_field_options WHERE field_id='${field.id}' ORDER BY position`).map((row) => [row.id, row.name]),
      options.map((option) => [option.id, option.id === major ? "Serious" : option.name]));
    assert.deepEqual(sql(`SELECT * FROM issues WHERE id='${issue.id}'`)[0], stored, "the rename leaves the issue as it was");

    // A document reload hydrates the renamed option in place, with the same stored identity.
    await beforePrivateNavigation(page, detail);
    await page.goto(detail);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.issue-property-bar select[aria-label="Issue Severity"]')?.disabled === false);
    assert.equal(await picker.inputValue(), major);
    assert.equal(await picker.locator("option:checked").textContent(), "Serious");
    await page.locator("details.issue-history > summary").click();
    await page.getByText("Severity: None → Serious", { exact: true }).waitFor();
    await capture("field-001-issue-renamed");
    await inspect(page, ".issue-property-bar", "issue-properties", evidence);
  });
}
