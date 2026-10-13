import assert from "node:assert/strict";
import { settingsSchema } from "../../src/core/features/settings/schema.ts";
import { preferencesSchema } from "../../src/core/features/notifications/ui/data.ts";

export async function settingsRead(page) {
  const response = await page.request.get(
    new URL("/api/settings", page.url()).href,
  );
  assert.equal(response.status(), 200, "native settings GET succeeds");
  return settingsSchema.parse(await response.json());
}
export async function preferencesRead(page) {
  const response = await page.request.get(
    new URL("/api/settings/notifications", page.url()).href,
  );
  assert.equal(response.status(), 200, "native notification GET succeeds");
  return preferencesSchema.parse(await response.json());
}
export async function assertSetupGuidance(
  page,
  { emailAvailable, emailEnabled },
) {
  const [settings, preferences] = await Promise.all([
    settingsRead(page),
    preferencesRead(page),
  ]);
  assert.equal(
    preferences.emailAvailable,
    emailAvailable,
    "availability agrees with deliberate installation mode",
  );
  if (emailEnabled !== undefined)
    assert.equal(preferences.emailEnabled, emailEnabled);
  const notifications = page.getByRole("region", {
    name: "Notifications",
    exact: true,
  });
  const checkbox = notifications.getByLabel("Email assignments and mentions", {
    exact: true,
  });
  await checkbox.waitFor();
  await page.waitForFunction(() => {
    const fieldset = document.querySelector(".notifications-panel fieldset");
    return fieldset && !fieldset.disabled;
  });
  assert.equal(await checkbox.isEnabled(), emailAvailable);
  assert.equal(
    await checkbox.isChecked(),
    emailAvailable && preferences.emailEnabled,
  );
  const guide = notifications.getByRole("link", {
    name: "deployment guide",
    exact: true,
  });
  if (emailAvailable) {
    assert.equal(
      await guide.count(),
      0,
      "available mail has no unavailable-mail guidance",
    );
    assert.doesNotMatch(await notifications.textContent(), /[Aa]sk.*deploy/s);
  } else {
    assert.match(
      await notifications.textContent(),
      /[Aa]sk.*deploy/s,
      "disabled mail explains responsible person",
    );
    assert.match(
      await guide.getAttribute("href"),
      /DEPLOY\.md$/,
      "disabled mail links to setup instructions",
    );
  }
  const operators = page.getByRole("region", {
    name: "Operators",
    exact: true,
  });
  assert.equal(
    settings.workspace.setupOperatorId,
    null,
    "installation still lacks its owner setup marker",
  );
  assert.match(
    await operators.textContent(),
    /[Aa]sk.*deployed.*setup/s,
    "disabled removal explains next step",
  );
  const removals = operators.getByRole("button", { name: /^Remove / });
  assert.equal(await removals.count(), settings.operators.length);
  for (const removal of await removals.all())
    assert.equal(await removal.isDisabled(), true);
  const target = settings.operators.find(
    (row) => row.id !== settings.operatorId,
  );
  assert.ok(target, "distinct removal target exists");
  const denied = await page.request.delete(
    new URL("/api/settings/operators/" + target.id, page.url()).href,
    {
      headers: { Origin: new URL(page.url()).origin },
    },
  );
  assert.equal(denied.status(), 409);
  assert.equal((await denied.json()).error, "setup_owner_unknown");
  assert.deepEqual(
    (await settingsRead(page)).operators,
    settings.operators,
    "denied removal preserves every operator",
  );
  return preferences;
}

export async function toggleEmailPreference(page, enabled) {
  const path = "/api/settings/notifications";
  const response = (method) =>
    page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === path && r.request().method() === method,
    );
  const checkbox = page.getByLabel("Email assignments and mentions", {
    exact: true,
  });
  assert.equal(await checkbox.isChecked(), !enabled);
  // This controlled checkbox changes only after its server receipt. Await that
  // receipt instead of requiring an optimistic state change immediately on click.
  const [patched, refreshed] = await Promise.all([
    response("PATCH"),
    response("GET"),
    checkbox.click(),
  ]);
  for (const receipt of [patched, refreshed]) {
    assert.equal(receipt.status(), 200);
    const value = preferencesSchema.parse(await receipt.json());
    assert.equal(value.emailAvailable, true);
    assert.equal(value.emailEnabled, enabled);
  }
  await page.reload();
  return assertSetupGuidance(page, {
    emailAvailable: true,
    emailEnabled: enabled,
  });
}
