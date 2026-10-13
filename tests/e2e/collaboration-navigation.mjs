import { lifecycleOperation } from "./collaboration-lifecycle.mjs";
import assert from "node:assert/strict";
const inFlight = new WeakMap();
// Polling reads (notification count, issue following) start on their own
// timers, and leaving a page aborts the reads it still owns. A journey waits
// for each read already in flight before it navigates.
export function trackRequests(page) {
  let pending = inFlight.get(page);
  if (pending) return pending;
  pending = new Set();
  inFlight.set(page, pending);
  page.on("request", (request) => {
    if (["fetch", "xhr"].includes(request.resourceType())) pending.add(request);
  });
  const settle = (request) => pending.delete(request);
  page.on("requestfinished", settle);
  page.on("requestfailed", settle);
  return pending;
}
// Readiness is a deadline, never permission to navigate over unfinished I/O.
export async function settleReads(page, limit = 10000) {
  const pending = trackRequests(page);
  const deadline = performance.now() + limit;
  // A page just shown starts its reads from effects; give them a moment to begin.
  await page.waitForTimeout(Math.min(150, limit));
  while (pending.size && performance.now() < deadline)
    await page.waitForTimeout(Math.min(20, deadline - performance.now()));
  assert.equal(
    pending.size,
    0,
    "[Vector browser] reads still pending before navigation: " +
      JSON.stringify(
        [...pending].map((r) => [r.method(), new URL(r.url()).pathname]),
      ),
  );
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
