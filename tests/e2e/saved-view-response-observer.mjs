import assert from "node:assert/strict";

// Test observation only: return the original fetch/json promises and values,
// preserve their receivers, and never replace an HTTP response or body.
export function installNativePatchObserver(target) {
  const nativeFetch = globalThis.fetch;
  const proof = { parsed: false, processed: false, status: null, body: null, error: null };
  const error = reason => { proof.error = String(reason?.message ?? reason).split("Call log:")[0]; };
  function observedFetch(...args) {
    const input = args[0], init = args[1];
    const path = new URL(typeof input === "string" || input instanceof URL ? input : input.url, target.base).pathname;
    const method = (init?.method ?? input?.method ?? "GET").toUpperCase();
    const promise = Reflect.apply(nativeFetch, this, args);
    if (path === target.path && method === "PATCH") {
      promise.then(response => {
        proof.status = response.status;
        const nativeJson = response.json;
        response.json = function (...jsonArgs) {
          const bodyPromise = Reflect.apply(nativeJson, this, jsonArgs);
          bodyPromise.then(body => {
            proof.body = body;
            proof.parsed = true;
            // The native body promise's application continuations drain at the
            // microtask checkpoint before this browser render checkpoint.
            globalThis.requestAnimationFrame(() => { proof.processed = true; });
          }, error);
          return bodyPromise;
        };
      }, error);
    }
    return promise;
  }
  globalThis.fetch = observedFetch;
  proof.restore = () => {
    globalThis.fetch = nativeFetch;
    delete globalThis.__savedViewPatchProof;
  };
  globalThis.__savedViewPatchProof = proof;
}

export async function observeSavedViewPatch(page, base, path) {
  await page.evaluate(installNativePatchObserver, { base, path });
}

export async function savedViewPatchProcessed(page, expected) {
  await page.waitForFunction(() => {
    const proof = globalThis.__savedViewPatchProof;
    return Boolean(proof && (proof.error !== null || proof.processed));
  });
  const proof = await page.evaluate(() => {
    const { parsed, processed, status, body, error } = globalThis.__savedViewPatchProof;
    return { parsed, processed, status, body, error };
  });
  assert.equal(proof.error, null, "genuine native PATCH/json completion has no error");
  assert.equal(proof.status, 200, "genuine PATCH succeeded");
  assert.equal(proof.parsed, true);
  assert.equal(proof.processed, true);
  assert.equal(proof.body.id, expected.id);
  assert.equal(proof.body.name, expected.name);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
}

export async function restoreSavedViewPatchObserver(page) {
  await page.evaluate(() => globalThis.__savedViewPatchProof?.restore());
}
