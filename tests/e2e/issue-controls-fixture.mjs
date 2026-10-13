import { confirmLink } from './outbox-session.mjs';
import { settled } from "./ui-state-audit.mjs";
import assert from "node:assert/strict";

export function apiActor(runtime, cookie) {
  return async (path, method = "GET", body, expected = 200) => {
    const response = await runtime.req(path, { method, headers: { Cookie: cookie, Origin: runtime.base, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const json = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(json)}`);
    return json;
  };
}

export async function createBrowseFixture(runtime, cookie, opts) {
  const api = apiActor(runtime, cookie);
  assert.ok(opts.teams.length>1,"VIEW-005 fixture is a multi-team workspace");
  assert.ok(opts.projects.length && opts.labels.length && opts.operators.length,"VIEW-004 fixture provides every editable target");
  const team = opts.teams[0];
  assert.ok(opts.cycles.some(c=>c.teamId===team.id),"VIEW-004 fixture provides an open team cycle");
  const statuses = opts.statuses.filter(s => s.teamId === team.id);
  const backlog = statuses.find(s => s.category === "backlog") ?? statuses.find(s => s.category === "unstarted");
  const started = statuses.find(s => s.category === "started");
  const completed = statuses.find(s => s.category === "completed");
  assert.ok(backlog && started && completed, "fixture has ordinary workflow states");
  const common = { teamId: team.id, statusId: backlog.id };
  const create = (title, changes = {}) => api("/api/issues", "POST", { ...common, title, ...changes }, 201);
  const a = await create("Browse proof alpha", { priority: "high", dueDate: "2020-01-01" });
  const b = await create("Browse proof beta", { priority: "urgent" });
  await api(`/api/issues/${a.identifier}/dependencies`, "POST", {expectedVersion:a.version,relatedIdentifier:b.identifier,relatedVersion:b.version,direction:"blocks"});
  const done = await create("Browse proof completed", { statusId: completed.id });
  const intake = await api("/api/intake", "POST", { title: "Browse proof intake", teamId: team.id, summary: "Evidence for refusal proof" }, 201);
  // VIEW-001 paging uses genuine records, never intercepted API responses.
  const list = await api("/api/issues?q=Browse%20proof");
  for (let i = 0; i < list.pageSize; i++) await create(`Browse proof page ${String(i).padStart(3, "0")}`);
  return { api, opts, team, backlog, started, completed, a, b, done, intake, pageSize: list.pageSize };
}

// A second sample operator signs in through the local outbox, like the first.
export async function signInBrowsePeer(runtime, browser, viewport) {
  const email = "maya@vector.test";
  const requested = await runtime.req("/auth/request", { method: "POST", headers: { Origin: runtime.base, "Content-Type": "application/json" }, body: JSON.stringify({ email, returnTo: "/app" }) });
  assert.equal(requested.status, 202);
  const link = runtime.sql(`SELECT json_extract(message,'$.text') AS sign_in_url FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='${email}' ORDER BY created_at DESC,sequence DESC LIMIT 1`)[0].sign_in_url.match(/https?:\/\/[^\s]+/)[0];
  const signed = await confirmLink(link);
  assert.equal(signed.status, 303);
  const peerCookie = signed.headers.get("set-cookie").split(";")[0];
  const split = peerCookie.indexOf("=");
  const context = await browser.newContext({ viewport });
  await context.addCookies([{ name: peerCookie.slice(0, split), value: peerCookie.slice(split + 1), url: runtime.base }]);
  const page = await context.newPage();
  return { context, page, cookie: peerCookie, api: apiActor(runtime, peerCookie) };
}

// The browser sends the request itself and nothing is intercepted: an in-page
// fetch hook hands the genuine response's status and body to the test as it
// arrives. CDP request interception paused every request of the page while a
// route was installed, route.fetch replayed the mutation on Playwright's own
// keep-alive client (closed by the dev server after 5 s idle: "socket hang up"),
// and Playwright's response.text() waits forever once the page navigates on.
// beforeSend runs after the page has built its request and before the server
// sees it, so a concurrent change cannot be absorbed by a later page refresh.
let hooks = 0;
export async function browserReceipt(page, path, method, action, status = 200, beforeSend) {
  const receipt = `__vectorReceipt${++hooks}`, before = `__vectorBeforeSend${hooks}`;
  let captured;
  await page.exposeFunction(receipt, (code, text) => { captured = { status: code, text }; });
  if (beforeSend) await page.exposeFunction(before, beforeSend);
  await page.evaluate(({ path, method, receipt, before }) => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const request = new Request(input, init);
      if (new URL(request.url).pathname !== path || request.method !== method) return original(input, init);
      window.fetch = original;
      if (before) await window[before]();
      const response = await original(input, init);
      void response.clone().text().then((text) => window[receipt](response.status, text));
      return response;
    };
  }, { path, method, receipt, before: beforeSend ? before : null });
  await action();
  for (let waited = 0; !captured; waited += 50) {
    assert.ok(waited < 20000, `${method} ${path}: no response`);
    await page.waitForTimeout(50);
  }
  assert.equal(captured.status, status, `${method} ${path}: ${captured.text}`);
  await settled(page);
  return captured.text ? JSON.parse(captured.text) : null;
}
