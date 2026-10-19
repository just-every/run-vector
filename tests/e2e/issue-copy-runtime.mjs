import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import {
  createAdminRuntime,
  bootstrapOwner,
} from "./admin-runtime-support.mjs";
const evidence = resolve(".artifacts/verification/issue-copy");
await mkdir(evidence, { recursive: true });
const runtime = createAdminRuntime(1440, [], {
  port: 15968,
  inspectorPort: 15969,
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
  const call = async (path, method = "GET", data, expected = 200) => {
    const r = await context.request.fetch(runtime.base + "/api" + path, {
      method,
      headers: { Origin: runtime.base },
      data,
    });
    assert.equal(r.status(), expected, await r.text());
    return r.json();
  };
  let state = await call("/settings/administration");
  const team = state.teams[0];
  for (const [name, color] of [
    ["Billing", "#aabbcc"],
    ["Quarterly close", "#112233"],
  ])
    await call("/settings/labels", "POST", { name, color });
  state = await call("/settings/administration");
  const labelIds = state.labels.map((l) => l.id);
  const issue = await call(
    "/issues",
    "POST",
    {
      title: "Prepare the October billing reconciliation",
      teamId: team.id,
      description:
        "Reconcile **invoice totals** and document exceptions before the next delivery cycle.",
      priority: "high",
      estimate: 5,
      labelIds,
      customFields: { department: "Finance", severity: "Standard" },
    },
    201,
  );
  let tree = await call(
    `/issues/${issue.identifier}/subissues`,
    "POST",
    {
      expectedVersion: issue.version,
      title: "Reconcile payment provider totals",
    },
    201,
  );
  tree = await call(
    `/issues/${issue.identifier}/subissues`,
    "POST",
    {
      expectedVersion: tree.version,
      title: "Document foreign currency adjustments",
    },
    201,
  );
  await call(
    `/issues/${issue.identifier}/comments`,
    "POST",
    { body: "Keep the discussion on the original issue." },
    201,
  );
  await call(
    `/issues/${issue.identifier}/links`,
    "POST",
    {
      name: "Billing specification",
      url: "https://example.test/billing-specification",
    },
    201,
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(runtime.base + "/app/issues/" + issue.identifier);
    await page.waitForFunction(
      () =>
        !document.body.textContent.includes("Loading personal reminders") &&
        !document.body.textContent.includes("Loading sub-issues"),
    );
    await page.getByText("Issue menu", { exact: true }).click();
    await page.screenshot({
      path: `${evidence}/ISSUE-023-issue-menu-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Copy issue…", exact: true })
      .click();
    let dialog = page.getByRole("dialog", {
      name: "Copy issue " + issue.identifier,
      exact: true,
    });
    await dialog.getByLabel("Include sub-issues", { exact: true }).check();
    await dialog.getByLabel("Include issue links", { exact: true }).check();
    await page.screenshot({ path: `${evidence}/ISSUE-023-menu-${width}.png` });
    await dialog
      .getByRole("button", { name: "Copy issue", exact: true })
      .click();
    const link = dialog.getByRole("link");
    await link.waitFor();
    const copyIdentifier = (await link.textContent()).split(" · ")[0];
    const original = await call("/issues/" + issue.identifier),
      copy = await call("/issues/" + copyIdentifier);
    for (const field of [
      "title",
      "description",
      "priority",
      "estimate",
      "labels",
      "customFields",
    ])
      assert.deepEqual(copy[field], original[field]);
    assert.equal(copy.status.category, "backlog");
    assert.equal(copy.children.length, 2);
    const discussion = await call("/issues/" + copyIdentifier + "/discussion");
    assert.equal(discussion.comments.length, 0);
    assert.ok(copy.activity.some((a) => a.kind === "issue.copied_from"));
    assert.ok(original.activity.some((a) => a.kind === "issue.copied_to"));
    await page.screenshot({
      path: `${evidence}/ISSUE-023-created-${width}.png`,
    });
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByText("History", { exact: true }).click();
    await page
      .getByText("Copied to " + copyIdentifier, { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${evidence}/ISSUE-023-original-activity-${width}.png`,
    });
    await page.getByRole("button", { name: /Search/ }).click();
    const palette = page.getByRole("dialog");
    await palette
      .getByLabel("Search issues, projects, and commands")
      .fill("Copy issue");
    const command = page.getByRole("option", {
      name: new RegExp("^Copy issue " + issue.identifier + "\\b"),
    });
    await command.waitFor();
    await page.screenshot({
      path: `${evidence}/ISSUE-023-command-${width}.png`,
    });
    await command.click();
    dialog = page.getByRole("dialog", {
      name: "Copy issue " + issue.identifier,
      exact: true,
    });
    await dialog
      .getByRole("button", { name: "Copy issue", exact: true })
      .waitFor();
    await dialog.getByLabel("Destination team").selectOption(team.id);
    await page.screenshot({
      path: `${evidence}/ISSUE-023-palette-${width}.png`,
    });
    await dialog
      .getByRole("button", { name: "Copy issue", exact: true })
      .click();
    await dialog.getByRole("link").waitFor();
    const paletteCopy = await call(
      "/issues/" +
        (await dialog.getByRole("link").textContent()).split(" · ")[0],
    );
    assert.equal(paletteCopy.children.length, 0);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.goto(runtime.base + "/app/issues/" + copyIdentifier);
    await page
      .getByRole("heading", { name: issue.title, exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        !document.body.textContent.includes("Loading personal reminders") &&
        !document.body.textContent.includes("Loading sub-issues"),
    );
    await page.screenshot({ path: `${evidence}/ISSUE-023-copy-${width}.png` });
    await page.getByText("History", { exact: true }).click();
    await page
      .getByText("Copied from " + issue.identifier, { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${evidence}/ISSUE-023-activity-${width}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    console.log(
      `[ISSUE-023] ${width}: menu copies two children and links, no discussion; palette copies without children; distinct identifiers and bidirectional history`,
    );
  }
} catch (error) {
  if (page)
    await page
      .screenshot({ path: `${evidence}/ISSUE-023-failure.png` })
      .catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  await runtime.stop();
}
