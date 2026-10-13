import { finishFirstRun } from './first-run-fixture.mjs';
import assert from "node:assert/strict";
import { createWorkerExceptionDiagnostics } from "./worker-exception-diagnostics.mjs";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { readLocalD1 } from "./local-d1-read.mjs";
import { verificationDirectory } from "../../scripts/verification-paths.mjs";

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function poll(read, check, label) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await read();
    if (check(value)) return value;
    await pause(100);
  }
  assert.fail("Persistence did not settle: " + label);
}
export function createAdminRuntime(width, sourceFiles = []) {
  const exceptions = createWorkerExceptionDiagnostics(sourceFiles);
  const base = "http://127.0.0.1:15944";
  const state = resolve(
    ".artifacts/verification/admin-state",
    `${width}-${Date.now()}-${process.pid}`,
  );
  const config = {
    APP_ORIGIN: base,
    SEED_SAMPLE_DATA: "false",
    MAIL_MODE: "local-outbox",
    FIRST_OWNER_EMAIL: "owner@admin-runtime.test",
    FIRST_OWNER_NAME: "Administration owner",
    WORKSPACE_NAME: "Administration runtime",
    WORKSPACE_TIMEZONE: "Australia/Brisbane",
    DEFAULT_TEAM_NAME: "Delivery",
    DEFAULT_TEAM_PREFIX: "BOOT",
    SESSION_SECRET: "fixture-admin-runtime-local-secret-32-characters",
    MAIL_FROM: "Vector <signin@admin-runtime.test>",
  };
  const environment = {
    ...process.env,
    WRANGLER_SEND_METRICS: "false",
    // rer turns the local explorer off for product servers. This loopback test
    // Worker keeps it: fixture writes use its D1 door (runtime-d1.mjs).
    X_LOCAL_EXPLORER: "true",
    WRANGLER_LOG_PATH: resolve(verificationDirectory, "admin-wrangler-logs"),
  };
  const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
  let worker,
    log = "";
  function command(args) {
    return execFileSync(process.execPath, [wrangler, ...args], {
      encoding: "utf8",
      env: environment,
      maxBuffer: 16 * 1024 * 1024,
    });
  }
  async function available(port) {
    await new Promise((done, reject) => {
      const probe = createServer();
      probe.once("error", reject);
      probe.listen(port, "127.0.0.1", () => probe.close(done));
    });
  }
  return {
    base,
    state,
    config,
    sql: (query) => readLocalD1(state, query),
    workerExceptions: () => exceptions.snapshot(),
    get log() {
      return log;
    },
    initialize() {
      command([
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
    },
    async start() {
      await available(15944);
      await available(15945);
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
          "15944",
          "--inspector-port",
          "15945",
          "--persist-to",
          state,
          ...Object.entries(config).flatMap(([key, value]) => [
            "--var",
            key + ":" + value,
          ]),
        ],
        { env: environment, detached: true, stdio: ["ignore", "pipe", "pipe"] },
      );
      const record = (chunk) => {
        log += chunk;
        exceptions.append(chunk);
      };
      worker.stdout.on("data", record);
      worker.stderr.on("data", record);
      for (let attempt = 0; attempt < 150; attempt++) {
        if (worker.exitCode !== null)
          throw Error("Administration Worker exited: " + log);
        try {
          if ((await fetch(base + "/health")).ok) return;
        } catch {}
        await pause(200);
      }
      throw Error("Administration Worker readiness timed out: " + log);
    },
    async stop() {
      if (!worker) return;
      const owned = worker;
      worker = null;
      try {
        process.kill(-owned.pid, "SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
      for (let attempt = 0; attempt < 100 && owned.exitCode === null; attempt++)
        await pause(50);
      if (owned.exitCode === null) {
        try {
          process.kill(-owned.pid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      }
      assert.equal(
        owned.exitCode === null && owned.signalCode === null,
        false,
        "owned Worker stopped",
      );
    },
  };
}
export async function bootstrapOwner(page, runtime) {
  const { base, config, sql } = runtime;
  await page.goto(base + "/signin");
  await page
    .getByLabel("Email", { exact: true })
    .fill(config.FIRST_OWNER_EMAIL);
  const sent = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/auth/request" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Send sign-in link", exact: true })
    .click();
  assert.equal((await sent).status(), 202);
  const link = sql(
    "SELECT json_extract(message,'$.text') AS sign_in_url FROM rer_mail_development_outbox ORDER BY created_at DESC,sequence DESC LIMIT 1",
  )[0].sign_in_url.match(/https?:\/\/[^\s]+/)[0];
  assert.equal(new URL(link).pathname, "/auth/confirm");
  await page.goto(link);
  assert.equal(
    sql("SELECT count(*) n FROM oa_sessions")[0].n,
    0,
    "confirmation GET does not admit",
  );
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.waitForURL(base + "/setup");
  await finishFirstRun(page,base);await page.goto(base + "/app");
  await page.waitForURL(base + "/app");
  assert.equal(
    sql("SELECT count(*) n FROM issues")[0].n,
    0,
    "bootstrap has no sample issues",
  );
  for (const table of ["projects", "cycles", "labels"])
    assert.equal(
      sql(`SELECT count(*) n FROM ${table}`)[0].n,
      0,
      "empty " + table,
    );
}
