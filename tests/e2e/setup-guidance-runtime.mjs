// Real emitted Worker, native D1 and native assets. Only external network is denied.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdir, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { readLocalD1 } from "./local-d1-read.mjs";
import { resolve } from "node:path";
import { localAuthSecret } from "./outbox-session.mjs";
import { devKey } from "./dev-gate.mjs";
const require = createRequire(import.meta.resolve("wrangler"));
const {
  unstable_getMiniflareWorkerOptions,
  splitSqlQuery,
} = require("wrangler");
const {
  Miniflare,
  Log,
  LogLevel,
  convertV4MiniflareOptions,
} = require("miniflare");

export async function setupGuidanceRuntime() {
  const base = "https://127.0.0.1:15946";
  const state = resolve(
    ".artifacts/verification/setup-state",
    `${Date.now()}-${process.pid}`,
  );
  await mkdir(state, { recursive: true, mode: 0o700 });
  const emitted = unstable_getMiniflareWorkerOptions(
    resolve("dist/server/wrangler.json"),
  );
  let worker,
    outboundAttempts = 0;
  const { modulesRules: _rules, ...workerOptions } = emitted.workerOptions;
  const modulePaths = (
    await readdir(resolve("dist/server"), { recursive: true })
  )
    .filter((name) => /\.m?js$/.test(name))
    .map((name) => resolve("dist/server", name));
  const orderedModules = [
    emitted.main,
    ...modulePaths.filter((path) => path !== emitted.main).sort(),
  ];
  const common = {
    ...workerOptions,
    modulesRoot: resolve("dist/server"),
    modules: orderedModules.map((path) => ({ type: "ESModule", path })),
    host: "127.0.0.1",
    port: 15946,
    https: true,
    resourcePersistencePath: resolve(state, "v3"),
    cf: false,
    telemetry: { enabled: false },
    log: new Log(LogLevel.NONE),
    outboundService() {
      outboundAttempts++;
      throw new Error("External network forbidden during setup proof");
    },
  };
  const bindings = {
    SEED_SAMPLE_DATA: "true",
    APP_ORIGIN: base,
    SESSION_SECRET: localAuthSecret,
    RER_DEV_KEY: devKey,
    FIRST_OWNER_EMAIL: "sarah@vector.test",
    MAIL_FROM: "Vector <signin@vector.test>",
  };
  async function start(mode) {
    assert.ok(
      !worker,
      "previous native runtime must stop before mode transition",
    );
    const selected =
      mode === "hosted-incomplete"
        ? {
            ...bindings,
            MAIL_MODE: "production",
            MAIL_FROM: "",
            MAIL_PROVIDER: "",
            MAIL_API_KEY: "",
            NOTIFICATION_EMAIL_ENABLED: "false",
          }
        : mode === "hosted-disabled"
          ? {
              ...bindings,
              MAIL_MODE: "production",
              MAIL_PROVIDER: "sendgrid",
              MAIL_API_KEY: "unusable-fixture-key-network-denied",
              NOTIFICATION_EMAIL_ENABLED: "false",
            }
          : {
              ...bindings,
              MAIL_MODE: "local-outbox",
              NOTIFICATION_EMAIL_ENABLED:
                mode === "local-available" ? "true" : "false",
            };
    worker = new Miniflare(
      convertV4MiniflareOptions({ ...common, bindings: selected }),
    );
    let timeout;
    try {
      await Promise.race([
        worker.ready,
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Setup Worker readiness timed out")),
            30_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
    console.info(JSON.stringify({ phase: mode, status: "started" }));
  }
  async function stop() {
    if (worker) {
      const owned = worker;
      worker = null;
      await owned.dispose();
    }
  }
  async function rows(query) {
    return readLocalD1(state, query);
  }
  return {
    base,
    start,
    stop,
    rows,
    attempts: () => outboundAttempts,
    async initialize() {
      // Apply the unchanged migrations through the same native Wrangler command
      // as the other UI installations. Runtime observations are read-only SQLite.
      execFileSync(
        process.execPath,
        [
          resolve("node_modules/wrangler/bin/wrangler.js"),
          "d1",
          "migrations",
          "apply",
          "vector-local",
          "--local",
          "--config",
          "wrangler.jsonc",
          "--persist-to",
          state,
        ],
        {
          env: {
            ...process.env,
            WRANGLER_SEND_METRICS: "false",
            WRANGLER_LOG_PATH: resolve(state, "logs"),
          },
          stdio: "pipe",
          maxBuffer: 16 * 1024 * 1024,
        },
      );
      return (await readdir("migrations/core")).filter((name) =>
        name.endsWith(".sql"),
      ).length;
    },
  };
}
