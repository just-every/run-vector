import { expect } from '@playwright/test';
import assert from "node:assert/strict";

export async function openDisclosures(page) {
  // Existing visible disclosures may be nested; opening a parent reveals children.
  await page.locator("main:visible").waitFor({ state: "visible" });
  await page.locator("details").evaluateAll((elements) => {
    for (const element of elements)
      if (element.getClientRects().length) element.open = true;
  });
}

export { openAdministrationForm } from "./ui-administration-form.mjs";
export async function openAccountMenu(page) {
  const trigger = page.locator('.app-mobile-account-trigger');
  if (await trigger.isVisible() && await trigger.getAttribute('aria-expanded') === 'false') {
    await expect(trigger).toBeEnabled({ timeout: 30_000 });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.locator('.app-mobile-account-menu').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    assert.equal(await trigger.evaluate(element => document.activeElement === element), true,
      'Escape returns focus to the account control');
    await page.keyboard.press('Space');
    await page.locator('.app-mobile-account-menu').waitFor({ state: 'visible' });
  }
}

export async function assertSettingsSections(page, label) {
  const sections = [
    "Workspace time",
    "Members",
    "Teams",
    "Labels",
    "Projects",
    "Cycles",
    "Data / Move in",
    "Integrations",
  ];
  for (const name of sections) {
    const section = page.getByRole("region", { name, exact: true });
    await section.waitFor();
    assert.equal(
      await section.getByRole("heading", { name, exact: true }).count(),
      1,
      `${label}: named ${name} section`,
    );
  }
  const notifications = page.getByRole("region", {
    name: "Notifications",
    exact: true,
  });
  await notifications.waitFor();
  assert.equal(
    await notifications
      .getByRole("heading", { name: "Notifications", exact: true })
      .count(),
    1,
    `${label}: named Notifications section`,
  );
  await openAccountMenu(page);
  const settings = page
    .getByRole("link", { name: "Settings", exact: true })
    .filter({ visible: true })
    .first();
  assert.equal(
    await settings.getAttribute("aria-current"),
    "page",
    `${label}: visible Settings current navigation state`,
  );
  await settings.focus();
  assert.equal(
    await settings.evaluate((element) => element === document.activeElement),
    true,
    `${label}: Settings reachable by keyboard`,
  );
}
