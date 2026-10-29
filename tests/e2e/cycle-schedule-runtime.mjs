import assert from "node:assert/strict";
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import {
  createAdminRuntime,
  bootstrapOwner,
  poll,
} from "./admin-runtime-support.mjs";
const evidence = resolve(".artifacts/verification/cycle-schedule");
await mkdir(evidence, { recursive: true });
const runtime = createAdminRuntime(1440, [], {
  port: 15966,
  inspectorPort: 15967,
});
let browser, page;
try {
  runtime.initialize();
  await runtime.start();
  browser = await chromium.launch({
    headless: true,
    args: ["--use-mock-keychain", "--password-store=basic"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  await bootstrapOwner(page, runtime);
  const state = await (
    await context.request.get(runtime.base + "/api/settings/administration")
  ).json();
  const team = state.teams[0];
  // Read the committed schedule through its public door; saving keeps the
  // existing form and the user's focus instead of remounting its defaults.
  const savedSchedule = async (values) => {
    await page.waitForFunction(
      ({ name, values }) => {
        const form = document.querySelector(`form[aria-label="${name}"]`);
        return !!form && Object.entries(values).every(([field, value]) =>
          form.elements.namedItem(field)?.value === value);
      },
      { name: "Cycle schedule " + team.name, values },
      { polling: 200 },
    );
    const fields = { weeks: "weeks", cooldown: "cooldownWeeks", upcoming: "upcomingCount" };
    await poll(
      async () => (await context.request.get(runtime.base + "/api/settings/administration")).json(),
      (administration) => {
        const schedule = administration.cycleSchedules.find(item => item.teamId === team.id);
        return !!schedule && Object.entries(values).every(([field, value]) =>
          String(schedule[fields[field]]) === value);
      },
      "cycle schedule commits before read-back",
    );
  };
  const create = await context.request.post(runtime.base + "/api/issues", {
    headers: { Origin: runtime.base },
    data: {
      title: "Prepare the October billing reconciliation",
      teamId: team.id,
      description:
        "Reconcile invoice totals and document any exceptions before the next delivery cycle.",
      priority: "high",
    },
  });
  assert.equal(create.status(), 201);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(runtime.base + "/app/cycles");
    const form = page.getByRole("form", {
      name: "Cycle schedule " + team.name,
      exact: true,
    });
    await form.evaluate(element => { window.__scheduleForm = element; });
    const savedResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/cycle-schedule") && r.request().method() === "PUT",
    );
    await form.getByLabel("Cycle length (weeks)").fill("2");
    await form.getByLabel("Start weekday").selectOption("1");
    await form.getByLabel("Cooldown (weeks)").fill("1");
    await form.getByLabel("Upcoming cycles to keep").fill("3");
    await page.evaluate(() => { window.__scheduleFocus = document.activeElement; });
    assert.equal((await savedResponse).status(), 200);
    await savedSchedule({ weeks: "2", cooldown: "1", upcoming: "3" });
    assert.ok(await form.evaluate(element => element === window.__scheduleForm), "saving retains the schedule form");
    assert.ok(await page.evaluate(() => document.activeElement === window.__scheduleFocus), "saving retains field focus");
    await form.getByRole('status').waitFor();
    await page.waitForFunction(
      () => !document.querySelector('input[name="weeks"]')?.disabled,
    );
    await page
      .getByRole("heading", { name: team.name + " · Scheduled", exact: true })
      .waitFor();
    await form.getByLabel("Cycle length (weeks)").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${evidence}/CYCLE-007-scheduled-${width}.png`,
    });
    let saved = await (
      await context.request.get(runtime.base + "/api/settings/administration")
    ).json();
    let cycles = saved.cycles.filter((c) => c.teamId === team.id);
    assert.equal(cycles.length, 3);
    assert.equal(
      Date.parse(cycles[1].startsAt) - Date.parse(cycles[0].endsAt),
      7 * 86400000,
    );
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/cycle-schedule") && r.request().method() === "PUT",
    );
    await form.getByLabel("Cycle length (weeks)").fill("1");
    await form.getByLabel("Cooldown (weeks)").fill("0");
    await page.evaluate(() => { window.__scheduleFocus = document.activeElement; });
    assert.equal((await response).status(), 200);
    await savedSchedule({ weeks: "1", cooldown: "0" });
    assert.ok(await form.evaluate(element => element === window.__scheduleForm), "cadence edits retain the schedule form");
    assert.ok(await page.evaluate(() => document.activeElement === window.__scheduleFocus), "cadence edits retain field focus");
    await page.waitForFunction(
      () =>
        document.querySelector('input[name="weeks"]')?.value === "1" &&
        !document.querySelector('input[name="weeks"]')?.disabled,
    );
    saved = await (
      await context.request.get(runtime.base + "/api/settings/administration")
    ).json();
    assert.deepEqual(
      saved.cycles
        .filter((c) => c.teamId === team.id)
        .map((c) => c.id)
        .sort(),
      cycles.map((c) => c.id).sort(),
    );
    assert.equal(
      Date.parse(saved.cycles[0].endsAt) - Date.parse(saved.cycles[0].startsAt),
      7 * 86400000,
    );
    await page.screenshot({
      path: `${evidence}/CYCLE-007-changed-${width}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.goto(runtime.base + "/app/settings");
    await page
      .getByRole("heading", { name: "Automatic cycle schedule", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${evidence}/CYCLE-007-settings-${width}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    console.log(
      `[CYCLE-007] ${width}: save three cycles with cooldown, change cadence, preserve identities, read in Settings`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    runtime.base + "/app/issues/" + (await create.json()).identifier,
  );
  await page
    .getByRole("heading", {
      name: "Prepare the October billing reconciliation",
      exact: true,
    })
    .waitFor();
  await page.waitForFunction(
    () => !document.body.textContent.includes("Loading personal reminders"),
  );
  await page.screenshot({ path: `${evidence}/1440-app.png` });
  if (process.env.VECTOR_LISTING_CAPTURE === "true") {
    await mkdir("docs/retained-verification/ui", { recursive: true });
    await copyFile(
      `${evidence}/1440-app.png`,
      "docs/retained-verification/ui/1440-app.png",
    );
  }
} catch (error) {
  if (page)
    await page
      .screenshot({ path: `${evidence}/CYCLE-007-failure.png` })
      .catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  await runtime.stop();
}
