import { lifecycleOperation } from "./collaboration-lifecycle.mjs";
import assert from "node:assert/strict";
const inFlight = new WeakMap();
// Track the document that admitted each operation. Chromium does not always
// emit a terminal request event when it replaces a document after a poll starts.
export function trackRequests(page) {
  const existing = inFlight.get(page);
  if (existing) return existing.pending;
  const state = { pending: new Set(), document: 0, sequence: 0, settledSequence: null, settledAt: 0, departures: [] };
  const entries = new WeakMap();
  let navigation = null;
  inFlight.set(page, state);
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      navigation = request;
    if (["fetch", "xhr"].includes(request.resourceType())) {
      // Playwright's timing starts at 0 until a response arrives. Event order
      // records admission even for the very read that never gets a response.
      entries.set(request, { document: state.document, sequence: ++state.sequence, startedAt: Date.now() });
      state.pending.add(request);
    }
  });
  const settle = (request) => state.pending.delete(request);
  page.on("requestfinished", settle);
  page.on("requestfailed", (request) => {
    settle(request);
    if (navigation === request) navigation = null;
  });
  page.on("framenavigated", (frame) => {
    // SPA/history changes retain their document and every pending operation.
    if (frame !== page.mainFrame() || !navigation ||
        frame.url().split("#")[0] !== navigation.url()) return;
    navigation = null;
    for (const request of state.pending) {
      const entry = entries.get(request);
      if (entry.document !== state.document) continue;
      const cutoff = {
        method: request.method(), pathname: new URL(request.url()).pathname,
        document: entry.document, sequence: entry.sequence, startedAt: entry.startedAt,
        settledSequence: state.settledSequence,
        settledAt: state.settledAt, documentEndedAt: Date.now(),
      };
      // Only a read admitted after the preceding successful settle can be
      // owned by this departure. Earlier work and writes still fail the gate.
      if (state.settledSequence !== null && entry.sequence > state.settledSequence &&
          ["GET", "HEAD"].includes(request.method())) {
        state.pending.delete(request);
        console.info("[Vector document read cutoff] " + JSON.stringify(cutoff));
      } else {
        state.departures.push(cutoff);
      }
    }
    ++state.document;
  });
  return state.pending;
}
// Readiness is a deadline, never permission to navigate over unfinished I/O.
export async function settleReads(page, limit = 10000) {
  const pending = trackRequests(page);
  const state = inFlight.get(page);
  const deadline = performance.now() + limit;
  // A page just shown starts its reads from effects; give them a moment to begin.
  await page.waitForTimeout(Math.min(150, limit));
  while (pending.size && performance.now() < deadline)
    await page.waitForTimeout(Math.min(20, deadline - performance.now()));
  assert.deepEqual(state.departures, [],
    "[Vector browser] navigation cut off work admitted before the preceding settle");
  assert.equal(
    pending.size,
    0,
    "[Vector browser] reads still pending before navigation: " +
      JSON.stringify(
        [...pending].map((r) => [r.method(), new URL(r.url()).pathname]),
      ),
  );
  state.settledSequence = state.sequence;
  state.settledAt = Date.now();
}
// A full-document navigation unmounts private polling. Wait for the current
// native count request to finish so navigation does not abort legitimate I/O.
export async function beforePrivateNavigation(page, target) {
  trackRequests(page);
  const current = new URL(page.url()),
    destination = new URL(target);
  if (
    current.origin === destination.origin &&
    current.pathname.startsWith("/app")
  ) {
    const response = await page.waitForResponse(
      (response) =>
        response.url() === destination.origin + "/api/notifications/count" &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    assert.equal(
      await response.finished(),
      null,
      "native count response finished before private document navigation",
    );
    await page.waitForLoadState("networkidle");
    await settleReads(page);
  }
}
export async function navigate(page, target) {
  await lifecycleOperation(
    "navigation " + new URL(target).pathname,
    async () => {
      await beforePrivateNavigation(page, target);
      await page.goto(target);
    },
    page,
  );
}
