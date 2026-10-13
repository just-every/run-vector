import assert from "node:assert/strict";
import { settingsSchema } from "../../src/core/features/settings/schema.ts";
import { beforePrivateNavigation } from "./collaboration-navigation.mjs";
import { openDisclosures } from "./ui-controls-checks.mjs";

export async function saveWorkspaceTime({ page, runtime, clause, capture }) {
  const read = async () => {
    const response = await page.request.get(runtime.base + "/api/settings");
    assert.equal(response.status(), 200);
    return settingsSchema.parse(await response.json()).workspace;
  };
  const initial = await read();
  const timezone = page.getByLabel("IANA timezone", { exact: true });
  const reminder = page.getByLabel("Daily due reminder time", { exact: true });
  const changedTimezone = initial.timezone === "Europe/London" ? "UTC" : "Europe/London";
  async function submit(value) {
    await timezone.fill(value);
    const [response] = await Promise.all([
      page.waitForResponse(response =>
        new URL(response.url()).pathname === "/api/settings" &&
        response.request().method() === "PATCH"),
      page.locator('#workspace-time button[type="submit"]').click(),
    ]);
    assert.equal(response.status(), 200);
    const saved = settingsSchema.parse(await response.json()).workspace;
    assert.equal(saved.timezone, value);
    assert.equal(saved.reminderTime, initial.reminderTime);
    await page.locator('#workspace-time button[type="submit"]:enabled').waitFor();
    const feedback = page.locator("main.settings-page > p[role='status']").last();
    await feedback.waitFor();
    assert.ok((await feedback.innerText()).trim());
    const current = await read();
    assert.equal(current.timezone, value);
    assert.equal(current.reminderTime, initial.reminderTime);
  }
  await clause("OPS-003", "workspace time saves through the form and survives restart without changing the reminder", async () => {
    assert.equal(await timezone.inputValue(), initial.timezone);
    assert.equal(await reminder.inputValue(), initial.reminderTime);
    assert.equal(await page.getByRole("button", {
      name: "Remove " + runtime.config.FIRST_OWNER_NAME,
      exact: true,
    }).isDisabled(), true, "the sole operator cannot be removed from Settings");
    await submit(changedTimezone);
    await capture("workspace-time-saved");
    // Drain this origin's private reads, then unload the app without mounting
    // another hydrated document that can fetch assets while its Worker stops.
    // The browser context retains the native session for the restart readback.
    await beforePrivateNavigation(page, page.url());
    await page.goto("about:blank", { waitUntil: "load" });
    await runtime.stop();
    await runtime.start();
    await page.goto(runtime.base + "/app/settings");
    await openDisclosures(page);
    await timezone.waitFor();
    assert.equal(await timezone.inputValue(), changedTimezone);
    assert.equal(await reminder.inputValue(), initial.reminderTime);
    const persisted = await read();
    assert.equal(persisted.timezone, changedTimezone);
    assert.equal(persisted.reminderTime, initial.reminderTime);
    await capture("workspace-time-after-restart");
    // Later calendar journeys use the installation's original workspace zone.
    await submit(initial.timezone);
  });
}
