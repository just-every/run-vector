import assert from "node:assert/strict";
import test from "node:test";
import { savedViewHeldResponses, finishSavedViewProbe } from "./e2e/saved-view-held-responses.mjs";

function fixture({ method = "GET", cancellation = null as string | null, deliveryError = null as Error | null } = {}) {
  const text = '{ "views": [] }';
  const response = { status: () => 200, text: async () => text };
  const request = { method: () => method, headers: () => ({}), url: () => "https://vector.invalid/api/views", failure: () => cancellation ? { errorText: cancellation } : null };
  const delivered: unknown[] = [];
  let handler!: (route: unknown) => Promise<void>;
  let onDeliver = async () => {};
  let onUnroute = () => {};
  const route = {
    request: () => request,
    fetch: async () => response,
    fulfill: async (value: unknown) => { delivered.push(value); if (deliveryError) throw deliveryError; await onDeliver(); },
    fallback: async () => {},
    abort: async () => {},
  };
  const page = {
    route: async (_matches: unknown, next: typeof handler) => { handler = next; },
    unroute: async () => { onUnroute(); },
    on: () => {}, off: () => {}, isClosed: () => false,
  };
  return { page, route, text, response, delivered, invoke: () => handler(route), invokeRoute: (next: unknown) => handler(next),
    delivering: (next: typeof onDeliver) => { onDeliver = next; }, unrouting: (next: typeof onUnroute) => { onUnroute = next; } };
}

test("held response cleanup drains a late fallback before unroute and retains genuine response/text", async () => {
  const value = fixture();
  const transport = savedViewHeldResponses(value.page);
  const held = await transport.hold("/api/views", "GET");
  const delivery = value.invoke();
  // The route's server body is captured before its delivery gate opens.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(held.rows.length, 1);
  assert.equal(held.rows[0].text, value.text);
  let lateFallbackFinished = false;
  value.delivering(async () => {
    void value.invokeRoute({ ...value.route, fallback: async () => {
      await new Promise(resolve => setImmediate(resolve));
      lateFallbackFinished = true;
    } });
  });
  value.unrouting(() => assert.equal(lateFallbackFinished, true, "late callback completes before unroute"));
  const cleanup = await transport.close();
  await delivery;
  assert.deepEqual(cleanup.errors, []);
  assert.deepEqual(value.delivered, [{ response: value.response, body: value.text }]);
  assert.equal(held.rows.length, 1, "new callbacks pass through after holds stop");
});

test("an unexpected genuine delivery error is retained and fails the probe", async () => {
  const value = fixture({ deliveryError: new Error("unexpected delivery failure") });
  const transport = savedViewHeldResponses(value.page);
  await transport.hold("/api/views", "GET");
  const delivery = value.invoke();
  let cleanup: any;
  await assert.rejects(finishSavedViewProbe({ recordCleanup: (result: unknown) => { cleanup = result; } }, transport, null), /every genuine saved-view route/);
  await delivery;
  assert.equal(cleanup.errors[0].error, "unexpected delivery failure");
  assert.deepEqual(cleanup.retiredReads, []);
});

for (const method of ["GET", "PATCH"]) test(`${method}: only exact browser-proven GET cancellation retires a delivery`, async () => {
  const value = fixture({ method, cancellation: "net::ERR_ABORTED", deliveryError: new Error("cancelled transport") });
  const transport = savedViewHeldResponses(value.page);
  await transport.hold("/api/views", method);
  const delivery = value.invoke();
  const cleanup = await transport.close();
  await delivery;
  if (method === "GET") {
    assert.deepEqual(cleanup.errors, []);
    assert.deepEqual(cleanup.retiredReads, [{ path: "/api/views", method, cancellation: "net::ERR_ABORTED" }]);
  } else {
    assert.equal(cleanup.errors[0].error, "cancelled transport");
    assert.deepEqual(cleanup.retiredReads, []);
  }
});
