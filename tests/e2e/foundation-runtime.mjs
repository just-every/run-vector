import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const origin = "http://127.0.0.1:41866";
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
async function start() {
  worker = spawn(
    process.execPath,
    [
      wrangler,
      "dev",
      "--config",
      "dist/server/wrangler.json",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      "41866",
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
    "SELECT sign_in_url FROM local_mail_outbox ORDER BY created_at DESC LIMIT 1",
  )[0].sign_in_url;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(link);
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  await page.getByLabel("IANA timezone").fill("Europe/London");
  await page
    .getByRole("button", { name: "Save timezone", exact: true })
    .click();
  await page.getByText("Workspace timezone saved.", { exact: true }).waitFor();
  assert.equal(
    sql("SELECT timezone FROM workspace_settings")[0].timezone,
    "Europe/London",
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
    "Europe/London",
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
