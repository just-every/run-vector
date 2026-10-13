import { confirmLink } from './outbox-session.mjs';
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { request as httpRequest } from "node:http";
import { resolve } from "node:path";
import { freePort } from '../../scripts/base-onboarding/adapter-settings.mjs';
// A free port, never a fixed one: CI's ephemeral range can hand a fixed port to another socket.
const port = await freePort();
export const origin = `http://127.0.0.1:${port}`;
export const state = `.wrangler/removal-${process.pid}`;
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
const config = {
  APP_ORIGIN: origin,
  SEED_SAMPLE_DATA: "false",
  MAIL_MODE: "local-outbox",
  SESSION_SECRET:"fixture-native-runtime-secret-with-at-least-32-characters",
  MAIL_FROM:"Vector <signin@vector.test>",
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
// These independent synthetic personas now share an unspoofable local bucket.
// Reset only the mail fixture bucket between journeys; operator request limits
// and the separately asserted five-requests-then-429 auth policy stay intact.
export async function signIn(email) {
  sql("DELETE FROM access_rate_limits WHERE key LIKE 'base-magic:loopback:%'");
  const sent = await fetch(origin + "/auth/request", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, returnTo: "/app/settings" }),
  });
  assert.equal(sent.status, 202);
  const link = sql(
    `SELECT json_extract(message,'$.text') AS sign_in_url FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='${email}' ORDER BY created_at DESC LIMIT 1`,
  )[0].sign_in_url.match(/https?:\/\/[^\s]+/)[0];
  const consumed = await confirmLink(link);
  assert.equal(consumed.status, 303);
  const cookie = consumed.headers.get("set-cookie").split(";")[0];
  assert.equal((await api(cookie, "/session")).status, 200);
  const review = await api(cookie, "/setup");
  assert.equal(review.status, 200);
  const setup = await review.json();
  if (setup.owner && !setup.completed) {
    const completed = await api(cookie, "/setup/complete", "POST", { confirmed: true });
    assert.equal(completed.status, 200);
    assert.equal((await completed.json()).completed, true);
  }
  return cookie;
}
export const api = (cookie, path, method = "GET", body) =>
  fetch(origin + "/api" + path, {
    method,
    headers: { cookie, origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
export function heldRequest(cookie, path, method, prefix, base = origin) {
  let request;
  const response = new Promise((resolve, reject) => {
    request = httpRequest(
      base + "/api" + path,
      {
        method,
        // Synchronous D1 snapshots can outlast an idle pooled socket while
        // delaying its close event. Each deliberately held stream owns a fresh
        // connection, so the admission barrier measures the Worker request.
        agent: false,
        headers: {
          cookie,
          origin: base,
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
