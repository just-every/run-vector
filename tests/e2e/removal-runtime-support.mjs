import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { request as httpRequest } from "node:http";
import { resolve } from "node:path";
export const origin = "http://127.0.0.1:41920";
export const state = `.wrangler/removal-${process.pid}`;
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
const config = {
  APP_ORIGIN: origin,
  SEED_SAMPLE_DATA: "false",
  MAIL_MODE: "local-outbox",
  FIRST_OWNER_EMAIL: "owner@removal.test",
  FIRST_OWNER_NAME: "Workspace owner",
  WORKSPACE_NAME: "Removal verification",
  WORKSPACE_TIMEZONE: "Australia/Brisbane",
  DEFAULT_TEAM_NAME: "Engineering",
  DEFAULT_TEAM_PREFIX: "ENG",
};
const run = (args) =>
  execFileSync(process.execPath, [wrangler, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      WRANGLER_WRITE_LOGS: "false",
    },
  });
const queryResults = (queries) =>
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
      queries.join(";\n"),
      "--json",
    ]),
  );
export const sql = (query) => queryResults([query])[0].results;
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let worker;
export function migrate() {
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
}
export async function start() {
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
      "41920",
      "--inspector-port",
      "41921",
      "--persist-to",
      state,
      ...Object.entries(config).flatMap(([k, v]) => ["--var", k + ":" + v]),
    ],
    { env: process.env, detached: true, stdio: "ignore" },
  );
  for (let n = 0; n < 150; n++) {
    if (worker.exitCode !== null) throw Error("Owned worker exited");
    try {
      if ((await fetch(origin + "/health")).ok) return;
    } catch {}
    await pause(200);
  }
  throw Error("Owned worker readiness timed out");
}
export async function stop() {
  if (!worker) return;
  const owned = worker;
  worker = null;
  try {
    process.kill(-owned.pid, "SIGTERM");
  } catch (e) {
    if (e.code !== "ESRCH") throw e;
  }
  for (let n = 0; n < 100 && owned.exitCode === null; n++) await pause(50);
  if (owned.exitCode === null) {
    try {
      process.kill(-owned.pid, "SIGKILL");
    } catch (e) {
      if (e.code !== "ESRCH") throw e;
    }
  }
}
// These are distinct synthetic operators/clients. Keep the real five-requests
// per-IP mail admission limit in force without making the journey depend on
// which side of a fifteen-minute clock boundary its six clients happen to run.
const clientAddresses = new Map();
export async function signIn(email) {
  if (!clientAddresses.has(email))
    clientAddresses.set(email, `192.0.2.${clientAddresses.size + 1}`);
  const sent = await fetch(origin + "/auth/request", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "cf-connecting-ip": clientAddresses.get(email),
    },
    body: JSON.stringify({ email, returnTo: "/app/settings" }),
  });
  assert.equal(sent.status, 202);
  const link = sql(
    `SELECT sign_in_url FROM local_mail_outbox WHERE recipient='${email}' ORDER BY created_at DESC LIMIT 1`,
  )[0].sign_in_url;
  const consumed = await fetch(link, { redirect: "manual" });
  assert.equal(consumed.status, 302);
  return consumed.headers.get("set-cookie").split(";")[0];
}
export const api = (cookie, path, method = "GET", body) =>
  fetch(origin + "/api" + path, {
    method,
    headers: { cookie, origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
export function heldRequest(cookie, path, method, prefix) {
  let request;
  const response = new Promise((resolve, reject) => {
    request = httpRequest(
      origin + "/api" + path,
      {
        method,
        headers: {
          cookie,
          origin,
          "content-type": "application/json",
          "transfer-encoding": "chunked",
        },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(text) });
          } catch {
            reject(
              new Error(
                `Held native request returned non-JSON status ${res.statusCode}`,
              ),
            );
          }
        });
      },
    );
    request.on("error", reject);
    request.write(prefix);
  });
  // Preserve rejection for the caller while the body is deliberately held.
  // A connection failure must reach the caller's finally cleanup, not become
  // an unhandled rejection before it finishes the independent D1 snapshot.
  response.catch(() => {});
  return {
    response,
    release: (tail) => request.end(tail),
    abort: () => request.destroy(),
  };
}
export const rateCount = (actor) =>
  sql(
    `SELECT COALESCE(SUM(count),0) n FROM access_rate_limits WHERE key LIKE 'operator:${actor}:%'`,
  )[0].n;
export async function admitted(actor, before) {
  for (let n = 0; n < 20; n++) {
    if (rateCount(actor) > before) return;
    await pause(100);
  }
  throw Error("Streamed request never passed native admission");
}
export function retained() {
  const tables = [
    "issues",
    "issue_activity",
    "issue_comments",
    "issue_links",
    "issue_files",
    "intake_decisions",
    "evidence_revisions",
    "audit_records",
  ];
  const results = queryResults(
    tables.map((table) => `SELECT * FROM ${table} ORDER BY rowid`),
  );
  return Object.fromEntries(
    tables.map((table, i) => [table, results[i].results]),
  );
}
