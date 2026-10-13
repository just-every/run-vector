import assert from "node:assert/strict";
import test from "node:test";
import { installNativePatchObserver } from "./e2e/saved-view-response-observer.mjs";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
const target = { base: "http://observer.test", path: "/api/views/test-view" };

test("PATCH observer preserves original promises, response/body identity and native receivers", async () => {
  const nativeFetch = globalThis.fetch, nativeFrame = globalThis.requestAnimationFrame;
  const fetchResult = deferred<object>(), jsonResult = deferred<object>();
  const frames: Array<() => void> = [];
  let fetchThis: unknown, jsonThis: unknown;
  const receiver = {};
  const body = { id: "test-view", name: "genuine fixture body" };
  const response = { status: 200, json: function () { jsonThis = this; return jsonResult.promise; } };
  const fixtureFetch = function (this: unknown) { fetchThis = this; return fetchResult.promise; };
  globalThis.fetch = fixtureFetch as typeof fetch;
  globalThis.requestAnimationFrame = (callback => { frames.push(callback as () => void); return frames.length; }) as typeof requestAnimationFrame;
  try {
    installNativePatchObserver(target);
    const actualFetch = globalThis.fetch.call(receiver, target.path, { method: "PATCH" });
    assert.equal(actualFetch, fetchResult.promise);
    assert.equal(fetchThis, receiver);
    fetchResult.resolve(response);
    assert.equal(await actualFetch, response);
    const actualJson = response.json();
    assert.equal(actualJson, jsonResult.promise);
    assert.equal(jsonThis, response);
    jsonResult.resolve(body);
    assert.equal(await actualJson, body);
    const proof = (globalThis as any).__savedViewPatchProof;
    assert.equal(proof.body, body);
    assert.equal(proof.parsed, true);
    assert.equal(proof.processed, false);
    frames[0]();
    assert.equal(proof.processed, true);
    proof.restore();
    assert.equal(globalThis.fetch, fixtureFetch);
  } finally {
    globalThis.fetch = nativeFetch;
    globalThis.requestAnimationFrame = nativeFrame;
    delete (globalThis as any).__savedViewPatchProof;
  }
});

test("PATCH observer leaves genuine rejection intact and records it rather than hiding it", async () => {
  const nativeFetch = globalThis.fetch;
  const failure = new Error("genuine transport failure"), rejection = Promise.reject(failure);
  globalThis.fetch = (() => rejection) as typeof fetch;
  try {
    installNativePatchObserver(target);
    const result = globalThis.fetch(target.path, { method: "PATCH" });
    assert.equal(result, rejection);
    await assert.rejects(result, error => error === failure);
    assert.equal((globalThis as any).__savedViewPatchProof.error, failure.message);
  } finally {
    (globalThis as any).__savedViewPatchProof.restore();
    globalThis.fetch = nativeFetch;
  }
});
