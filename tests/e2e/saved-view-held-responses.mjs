import assert from "node:assert/strict";
import { fetchHeld } from "./route-fetch.mjs";

// Delay only actual Worker traffic. Each handler retains the server's status,
// headers and body, and accounts for delivery before the browser is torn down.
export function savedViewHeldResponses(page, { allowRetiredReads = true } = {}) {
  const holds = [], errors = [], retiredReads = [];
  const failed = new Map();
  const requestFailed = request => failed.set(request, request.failure()?.errorText);
  page.on("requestfailed", requestFailed);
  function fail(path, error) {
    errors.push({ path, error: String(error.message).split("Call log:")[0] });
  }
  async function hold(path, method, { beforeFetch = false, inspect, matchQuery, shouldHold = () => true } = {}) {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const rows = [], entries = [], deliveries = [], pending = new Set();
    const matches = url => new URL(url).pathname === path && (!matchQuery || matchQuery(new URL(url).searchParams));
    const handler = async route => {
      const request = route.request();
      let finish;
      const delivery = new Promise(resolve => { finish = resolve; });
      deliveries.push(delivery);
      pending.add(delivery);
      try {
        if (request.method() !== method || !state.accepting) return await route.fallback();
        entries.push(new URL(request.url()).searchParams);
        if (beforeFetch) await gate;
        const response = await fetchHeld(route);
        const body = await response.text();
        const row = { path, method, status: response.status(), body: JSON.parse(body), text: body };
        inspect?.(row);
        rows.push(row);
        if (!beforeFetch && shouldHold()) await gate;
        try { await route.fulfill({ response, body }); state.delivered++; }
        catch (error) {
          // A superseded GET is allowed only when the browser actually reported
          // cancellation for this exact request. Mutation delivery never is.
          const cancellation = failed.get(request) ?? request.failure()?.errorText;
          if (allowRetiredReads && method === "GET" && cancellation === "net::ERR_ABORTED" && !page.isClosed())
            retiredReads.push({ path, method, cancellation });
          else throw error;
        }
      } catch (error) {
        fail(path, error);
        try { await route.abort(); }
        catch (abortError) { fail(path, abortError); }
      } finally { pending.delete(delivery); finish(); }
    };
    const state = { path, method, rows, entries, deliveries, pending, release, matches, handler, accepting: true, registered: true, delivered: 0 };
    holds.push(state);
    await page.route(matches, handler);
    return state;
  }
  async function ready(predicate, message) {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      assert.deepEqual(errors, [], "genuine saved-view route delivery has no error");
      assert.ok(Date.now() < deadline, message);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    }
    assert.deepEqual(errors, [], "genuine saved-view route delivery has no error");
  }
  async function drain(states, deadline) {
    let timer;
    try {
      const complete = async () => {
        do {
          await Promise.all(states.flatMap(state => [...state.pending]));
          // Flush queued route callbacks too; a fixed snapshot can miss the
          // navigation poll or a fallback which entered while deliveries ran.
          await new Promise(resolve => setImmediate(resolve));
        } while (states.some(state => state.pending.size));
      };
      await Promise.race([complete(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("saved-view delivery cleanup exceeded 10 seconds")), Math.max(0, deadline - Date.now()));
      })]);
    } finally { clearTimeout(timer); }
  }
  async function cleanupRoute(state, states, deadline) {
    // Every callback is tracked, including fallbacks after acceptance stops.
    // Unroute removes the registration but can await protocol work while an
    // already dispatched callback enters. Own that window with a second drain.
    for (const action of [
      () => drain(states, deadline),
      async () => {
        await page.unroute(state.matches, state.handler);
        state.registered = false;
      },
      () => drain(states, deadline),
    ]) {
      try { await action(); }
      catch (error) { fail(state.path, error); }
    }
  }
  async function retire(state) {
    state.accepting = false;
    state.release();
    const previousErrors = errors.length;
    await cleanupRoute(state, [state], Date.now() + 10000);
    assert.deepEqual(errors.slice(previousErrors), [], "retired saved-view callbacks settled without delivery errors");
  }
  async function close() {
    const deadline = Date.now() + 10000;
    for (const state of holds) { state.accepting = false; state.release(); }
    for (const state of holds) {
      if (state.registered) await cleanupRoute(state, holds, deadline);
    }
    // Include callbacks admitted during the last unregister, even when it failed.
    try { await drain(holds, deadline); }
    catch (error) { fail("owned saved-view routes", error); }
    page.off("requestfailed", requestFailed);
    return { errors, retiredReads, responses: holds.flatMap(state => state.rows) };
  }
  return { hold, ready, retire, close, errors };
}

export async function assertEverySavedViewNavigation(page, view) {
  await page.waitForFunction(({ id, name }) => {
    const navs = [...document.querySelectorAll(".saved-view-navigation")];
    return navs.length > 0 && navs.every(nav => [...nav.querySelectorAll("a")].some(link =>
      new URL(link.href).pathname === `/app/views/${id}` && link.querySelector("span")?.textContent === name));
  }, view, { timeout: 3000 });
  assert.ok(await page.locator(".saved-view-navigation").count() > 0, "VIEW-002 genuine mounted navigation is checked");
}

export async function finishSavedViewProbe(context, transport, primaryFailure, restore) {
  const cleanup = await transport.close();
  try { await restore?.(); }
  catch (error) { cleanup.errors.push({ path: "native PATCH observer", error: error.message }); }
  await context.recordCleanup?.(cleanup);
  if (primaryFailure && cleanup.errors.length)
    throw new AggregateError([primaryFailure, ...cleanup.errors.map(row => new Error(`${row.path}: ${row.error}`))], "saved-view primary failure and delivery errors");
  if (primaryFailure) throw primaryFailure;
  assert.deepEqual(cleanup.errors, [], "every genuine saved-view route delivered or had a proven retired GET cancellation");
}
