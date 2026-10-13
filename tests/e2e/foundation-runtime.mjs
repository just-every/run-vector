import { freePort } from '@runeditrun/rer/adapter-settings';
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { settingsSchema } from "../../src/core/features/settings/schema.ts";

// A free port, never a fixed one: CI's ephemeral range can hand a fixed port to another socket.
const port = await freePort(), origin = `http://127.0.0.1:${port}`;
const state = `.wrangler/foundation-${process.pid}`;
const evidence = resolve(
  process.env.VECTOR_FOUNDATION_EVIDENCE ?? ".wrangler/foundation-evidence",
);
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
const processEnvironment = {
  ...process.env,
  WRANGLER_SEND_METRICS: "false",
  WRANGLER_LOG_PATH: resolve(".wrangler/foundation-logs"),
};
const config = {
  APP_ORIGIN: origin,
  SEED_SAMPLE_DATA: "false",
  MAIL_MODE: "local-outbox",
  SESSION_SECRET:"fixture-native-runtime-secret-with-at-least-32-characters",
  MAIL_FROM:"Vector <signin@vector.test>",
  FIRST_OWNER_EMAIL: "owner@foundation.test",
  FIRST_OWNER_NAME: "Workspace owner",
  WORKSPACE_NAME: "Foundation workspace",
  WORKSPACE_TIMEZONE: "Australia/Brisbane",
  DEFAULT_TEAM_NAME: "Delivery",
  DEFAULT_TEAM_PREFIX: "DLV",
};
const run = (args) =>
  execFileSync(process.execPath, [wrangler, ...args], {
    encoding: "utf8",
    env: processEnvironment,
    maxBuffer: 16 * 1024 * 1024,
  });
const sql = (query) =>
  JSON.parse(
    run([
      "d1",
      "execute",
      "vector-local",
      "--local",
      "--config",
      "wrangler.jsonc",
      "--persist-to",
      state,
      "--command",
      query,
      "--json",
    ]),
  )[0].results;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let worker, browser;
const settingsActionBudgetMs = 30_000;
const remainingSettingsActionMs = (deadline) => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("Workspace time action exceeded its original 30-second budget.");
  return remaining;
};
const responseJsonWithinSettingsBudget = async (response, deadline) => {
  let timer;
  try {
    return await Promise.race([
      response.json(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Settings response body exceeded the original action budget.")),
          remainingSettingsActionMs(deadline),
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
async function start() {
  worker = spawn(
    process.execPath,
    [
      resolve("tests/e2e/worker-serve.mjs"),
      "--config",
      "dist/server/wrangler.json",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--inspector-port",
      "0",
      "--persist-to",
      state,
      ...Object.entries(config).flatMap(([key, value]) => [
        "--var",
        key + ":" + value,
      ]),
    ],
    { env: processEnvironment, detached: true, stdio: "ignore" },
  );
  for (let i = 0; i < 150; i++) {
    if (worker.exitCode !== null)
      throw Error("Foundation Worker exited before readiness");
    try {
      if ((await fetch(origin + "/health")).ok) return;
    } catch {}
    await pause(200);
  }
  throw Error("Foundation Worker readiness timed out");
}
async function stop() {
  if (!worker) return;
  const owned = worker;
  worker = null;
  try {
    process.kill(-owned.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
  for (let i = 0; i < 100 && owned.exitCode === null; i++) await pause(50);
  if (owned.exitCode === null) {
    try {
      process.kill(-owned.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}
try {
  await mkdir(evidence, { recursive: true });
  run([
    "d1",
    "migrations",
    "apply",
    "vector-local",
    "--local",
    "--config",
    "wrangler.jsonc",
    "--persist-to",
    state,
  ]);
  await start();
  assert.equal(sql("SELECT count(*) n FROM operators")[0].n, 1);
  assert.equal(sql("SELECT count(*) n FROM teams")[0].n, 1);
  assert.equal(sql("SELECT count(*) n FROM workflow_statuses")[0].n, 7);
  assert.equal(sql("SELECT count(*) n FROM issues")[0].n, 0);
  const sent = await fetch(origin + "/auth/request", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      email: config.FIRST_OWNER_EMAIL,
      returnTo: "/app/settings",
    }),
  });
  assert.equal(sent.status, 202);
  const link = sql(
    "SELECT json_extract(message,'$.text') AS sign_in_url FROM rer_mail_development_outbox ORDER BY created_at DESC LIMIT 1",
  )[0].sign_in_url.match(/https?:\/\/[^\s]+/)[0];
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(link);
  await page.getByRole("button", {name:"Confirm",exact:true}).click();
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  const initialSettings = await page.evaluate(async () => {
    const response = await fetch("/api/settings");
    return { status: response.status, body: await response.json() };
  });
  assert.equal(initialSettings.status, 200);
  const initialWorkspace = settingsSchema.parse(initialSettings.body).workspace;
  assert.equal(typeof initialWorkspace.timezone, "string");
  assert.match(initialWorkspace.reminderTime, /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/);
  const timezone = page.getByLabel("IANA timezone", { exact: true });
  const reminderTime = page.getByLabel("Daily due reminder time", { exact: true });
  assert.equal(await timezone.inputValue(), initialWorkspace.timezone);
  assert.equal(await reminderTime.inputValue(), initialWorkspace.reminderTime);
  const savedTimezone = initialWorkspace.timezone === "Europe/London" ? "UTC" : "Europe/London";
  assert.notEqual(savedTimezone, initialWorkspace.timezone);
  await timezone.fill(savedTimezone);
  const workspaceTimeForm = page.locator("#workspace-time form");
  const saveWorkspaceTime = workspaceTimeForm.getByRole("button", {
    name: "Save workspace time",
    exact: true,
  });
  const settingsActionDeadline = Date.now() + settingsActionBudgetMs;
  const settingsSave = page
    .waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/settings" &&
        response.request().method() === "PATCH",
      { timeout: remainingSettingsActionMs(settingsActionDeadline) },
    )
    .then(async (response) => {
      const receivedBody = await responseJsonWithinSettingsBudget(
        response,
        settingsActionDeadline,
      );
      return {
        response,
        body: response.ok() ? settingsSchema.parse(receivedBody) : receivedBody,
      };
    });
  const settingsSaveClick = Promise.resolve().then(() =>
    saveWorkspaceTime.click({
      timeout: remainingSettingsActionMs(settingsActionDeadline),
    }),
  );
  const [clickOutcome, saveOutcome] = await Promise.allSettled([
    settingsSaveClick,
    settingsSave,
  ]);
  if (clickOutcome.status === "rejected" || saveOutcome.status === "rejected")
    throw new AggregateError(
      [clickOutcome, saveOutcome]
        .filter((outcome) => outcome.status === "rejected")
        .map((outcome) => outcome.reason),
      "Workspace time submission did not settle successfully.",
    );
  const saveReceipt = saveOutcome.value;
  assert.equal(saveReceipt.response.status(), 200);
  assert.equal(saveReceipt.body.workspace.timezone, savedTimezone);
  assert.equal(saveReceipt.body.workspace.reminderTime, initialWorkspace.reminderTime);
  await workspaceTimeForm
    .locator('button[type="submit"]:enabled')
    .waitFor({ timeout: remainingSettingsActionMs(settingsActionDeadline) });
  const settingsFeedback = page
    .locator("main.settings-page > p[role='status']")
    .filter({ hasNotText: /^Loading/ });
  await settingsFeedback
    .last()
    .waitFor({ timeout: remainingSettingsActionMs(settingsActionDeadline) });
  assert.ok((await settingsFeedback.last().innerText()).trim());
  const persistedSettings = await page.evaluate(async () => {
    const response = await fetch("/api/settings");
    return { status: response.status, body: await response.json() };
  });
  assert.equal(persistedSettings.status, 200);
  const persistedWorkspace = settingsSchema.parse(persistedSettings.body).workspace;
  assert.equal(persistedWorkspace.timezone, savedTimezone);
  assert.equal(persistedWorkspace.reminderTime, initialWorkspace.reminderTime);
  assert.equal(
    sql("SELECT timezone FROM workspace_settings")[0].timezone,
    savedTimezone,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Remove Workspace owner", exact: true })
      .isDisabled(),
    true,
  );
  await page.screenshot({
    path: resolve(evidence, "settings-1440.jpg"),
    type: "jpeg",
    quality: 85,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: resolve(evidence, "settings-390.jpg"),
    type: "jpeg",
    quality: 85,
    fullPage: true,
  });
  const before = sql("SELECT * FROM workspace_settings");
  await stop();
  await start();
  await page.reload();
  await page.getByLabel("IANA timezone").waitFor();
  assert.equal(
    await page.getByLabel("IANA timezone").inputValue(),
    savedTimezone,
  );
  assert.equal(
    await page.getByLabel("Daily due reminder time").inputValue(),
    initialWorkspace.reminderTime,
  );
  assert.deepEqual(sql("SELECT * FROM workspace_settings"), before);
  assert.equal(sql("SELECT count(*) n FROM operators")[0].n, 1);
  assert.equal(sql("SELECT count(*) n FROM issues")[0].n, 0);
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(evidence, "manifest.json"),
    JSON.stringify(
      {
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        at: new Date().toISOString(),
        passed: true,
        scope:
          "Local no-sample emitted Worker, native local outbox sign-in, timezone, removal guard, responsive settings, restart persistence. No real mail or deployed receipt.",
        captures: ["settings-1440.jpg", "settings-390.jpg"],
      },
      null,
      2,
    ),
  );
  console.log(
    "Foundation emitted Worker and responsive settings journey passed; local outbox only.",
  );
} finally {
  if (browser) await browser.close();
  await stop();
}
