import { localAuthArguments } from './outbox-session.mjs';
import { spawn, execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { verificationDirectory } from "../../scripts/verification-paths.mjs";
import { readLocalD1 } from "./local-d1-read.mjs";
import { writeRuntimeD1 } from "./runtime-d1.mjs";
import { freePort } from "@runeditrun/rer/adapter-settings";
const runtimePort = await freePort();
export function createUiRuntime() {
  const root = process.cwd(),
    base = "http://127.0.0.1:" + runtimePort,
    state = `.wrangler/vector-ui/runs/${Date.now()}-${process.pid}`;
  function command(args) {
    return execFileSync("pnpm", ["exec", "wrangler", ...args], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: resolve(verificationDirectory, "wrangler-logs"),
      },
      maxBuffer: 16 * 1024 * 1024,
    });
  }
  function sql(query) {
    return readLocalD1(state, query);
  }
  // Through the running Worker's own D1, never the SQLite file (runtime-d1.mjs).
  function writeFixture(script) {
    return writeRuntimeD1(base, script);
  }
  let worker,
    workerLog = "";
  function start(origin = base) {
    worker = spawn(
      process.execPath,
      [
        resolve("tests/e2e/worker-serve.mjs"),
        "--config",
        "dist/server/wrangler.json",
        "--local",
        "--test-scheduled",
        "--ip",
        "127.0.0.1",
        "--port",
        String(runtimePort),
        "--inspector-port",
        "0",
        "--persist-to",
        state,
        "--var",
        "APP_ORIGIN:" + origin,
        ...localAuthArguments,
        "--var",
        "NOTIFICATION_EMAIL_ENABLED:true",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          WRANGLER_LOG_PATH: resolve(verificationDirectory, "wrangler-logs"),
          // rer turns the local explorer off for product servers. This loopback test
          // Worker keeps it: fixture writes use its D1 door (runtime-d1.mjs).
          X_LOCAL_EXPLORER: "true",
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      },
    );
    worker.stdout.on("data", (b) => (workerLog += b));
    worker.stderr.on("data", (b) => (workerLog += b));
  }
  async function ready() {
    for (let i = 0; i < 150; i++) {
      if (worker.exitCode !== null) throw new Error(workerLog);
      if (!workerLog.includes("worker-serve ready on " + base)) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      try {
        if (
          (await fetch(base + "/health", { headers: { Connection: "close" } }))
            .ok
        )
          return;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error("Local worker did not become ready\n" + workerLog);
  }
  async function stop() {
    if (!worker) return;
    try {
      process.kill(-worker.pid, "SIGTERM");
    } catch {}
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(base + "/health", { headers: { Connection: "close" } });
      } catch {
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Owned runtime did not stop");
  }
  function req(path, init = {}) {
    return fetch(base + path, {
      redirect: "manual",
      ...init,
      headers: { ...init.headers, Connection: "close" },
    }).catch((error) => {
      throw new Error((init.method ?? "GET") + " " + path + " failed", {
        cause: error,
      });
    });
  }
  return {
    state,
    base,
    req,
    sql,
    writeFixture,
    start,
    ready,
    stop,
    // The app counts an operator's requests per calendar minute and one signed-in owner carries every journey of
    // this runtime. Each journey starts its own count through the fixture store; the app has no seam for this.
    freshRequestWindow() {
      return writeRuntimeD1(base, "DELETE FROM access_rate_limits WHERE key LIKE 'operator:%'");
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
    get log() {
      return workerLog;
    },
  };
}
