import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { z } from "zod";
import {
  createReadLifecycle,
  privateReads,
} from "../src/core/app/read-lifecycle.ts";
import {
  ApiError,
  createApiResourceController,
  fetchJson,
} from "../src/core/app/api-client.ts";
import { settleReads, trackRequests } from "./e2e/collaboration-navigation.mjs";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("Sign-out drains admitted reads, fences new reads and safely recovers on failure", async (context) => {
  // Scenario: "sign-out fences new GETs and drains the full response body without aborting admitted reads"
  await (async () => {
    const original = globalThis.fetch;
    const body = deferred<string>();
    let calls = 0;
    const abort = new AbortController();
    globalThis.fetch = async () => {
      calls++;
      return {
        ok: true,
        json: async () => JSON.parse(await body.promise),
      } as Response;
    };
    try {
      const read = fetchJson(
        "/api/mentions/options",
        z.object({ ok: z.boolean() }),
        { signal: abort.signal },
      );
      privateReads.pause();
      let settled = false;
      const draining = privateReads.settle().then(() => {
        settled = true;
      });
      await Promise.resolve();
      assert.equal(settled, false, "headers alone do not permit revocation");
      await assert.rejects(
        fetchJson("/api/notifications/count", z.unknown()),
        /Sign out is in progress/,
      );
      assert.equal(calls, 1, "no new private GET crosses the admission fence");
      assert.equal(abort.signal.aborted, false);
      body.resolve('{"ok":true}');
      assert.deepEqual(await read, { ok: true });
      await draining;
      assert.equal(settled, true);
    } finally {
      privateReads.resume();
      globalThis.fetch = original;
    }
  })();
  // Scenario: "failed sign-out drain is bounded, redacts diagnostics and permits retry after resume"
  await (async () => {
    const lifecycle = createReadLifecycle();
    const body = deferred<number>();
    const read = lifecycle.read(
      "https://user:secret@private.test/api/mentions/options?token=secret#secret",
      () => body.promise,
    );
    lifecycle.pause();
    await assert.rejects(lifecycle.settle(10), (error: Error) => {
      assert.match(
        error.message,
        /reads are still pending: \/api\/mentions\/options/,
      );
      assert.doesNotMatch(error.message, /secret|private.test|token/);
      return true;
    });
    lifecycle.resume();
    assert.equal(
      await lifecycle.read("/api/notifications/count", async () => 2),
      2,
    );
    body.resolve(1);
    assert.equal(await read, 1);
    lifecycle.pause();
    await lifecycle.settle(10);
  })();
  // Scenario: "polling pauses without abort and resumes; unexpected pre-signout 500 remains a visible failure"
  await (async () => {
    const original = globalThis.fetch;
    const response = deferred<Response>();
    const recovered = deferred<void>();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return response.promise;
    };
    const receipts: Array<{ error: Error | null }> = [];
    const controller = createApiResourceController(
      (signal) =>
        fetchJson("/api/notifications/count", z.unknown(), { signal }),
      (state) => {
        receipts.push(state);
        if (state.data !== null && state.error === null) recovered.resolve();
      },
    );
    try {
      const read = controller.refresh();
      privateReads.pause();
      await controller.refresh();
      assert.equal(calls, 1);
      response.resolve(
        new Response('{"message":"Unexpected server failure"}', {
          status: 500,
        }),
      );
      await read;
      await privateReads.settle();
      assert.ok(receipts.at(-1)?.error instanceof ApiError);
      assert.equal((receipts.at(-1)?.error as ApiError).status, 500);
      globalThis.fetch = async () => {
        calls++;
        return new Response("{}");
      };
      privateReads.resume();
      await recovered.promise;
      assert.equal(calls, 2);
      assert.equal(receipts.at(-1)?.error, null);
    } finally {
      privateReads.resume();
      controller.dispose();
      globalThis.fetch = original;
    }
  })();
  // Scenario: "navigation readiness fails at its deadline with only redacted request paths"
  await (async () => {
    const page = Object.assign(new EventEmitter(), {
      waitForTimeout: (ms: number) =>
        new Promise((done) => setTimeout(done, ms)),
    });
    trackRequests(page);
    const request = {
      resourceType: () => "fetch",
      method: () => "GET",
      url: () =>
        "https://user:secret@private.test/api/notifications/count?token=secret#secret",
    };
    page.emit("request", request);
    const start = performance.now();
    await assert.rejects(settleReads(page, 25), (error: Error) => {
      assert.match(error.message, /GET.*\/api\/notifications\/count/);
      assert.doesNotMatch(error.message, /secret|private.test|token/);
      return true;
    });
    assert.ok(performance.now() - start < 1000, "deadline is bounded");
    page.emit("requestfinished", request);
    await settleReads(page, 1);
  })();
  // Scenario: "genuine authorization/deletion denials admitted before sign-out still clear private state"
  await (async () => {
    const original = globalThis.fetch;
    try {
      for (const status of [401, 403, 404, 410]) {
        const response = deferred<Response>();
        globalThis.fetch = () => response.promise;
        const receipts: Array<{ data: unknown; error: Error | null }> = [];
        const controller = createApiResourceController(
          (signal) =>
            fetchJson("/api/mentions/options", z.unknown(), { signal }),
          (state) => receipts.push(state),
          {
            data: { private: "previously admitted" },
            error: null,
            loading: false,
          },
        );
        const read = controller.refresh();
        privateReads.pause();
        response.resolve(new Response("{}", { status }));
        await read;
        await privateReads.settle();
        assert.equal(receipts.at(-1)?.data, null);
        assert.equal((receipts.at(-1)?.error as ApiError).status, status);
        privateReads.resume();
        controller.dispose();
      }
    } finally {
      privateReads.resume();
      globalThis.fetch = original;
    }
  })();
  // Scenario: "failed sign-out resumes mounted non-polling resources but never disposed subscriptions"
  await (() => {
    const lifecycle = createReadLifecycle();
    const calls: boolean[] = [];
    lifecycle.pause();
    const unsubscribe = lifecycle.onResume(() => calls.push(lifecycle.paused));
    lifecycle.resume();
    assert.deepEqual(
      calls,
      [false],
      "admission is open before retry callbacks run",
    );
    unsubscribe();
    lifecycle.pause();
    lifecycle.resume();
    assert.deepEqual(calls, [false]);
  })();
  // Scenario: "a resource mounted during sign-out retries its skipped read once after failure; disposed resources do not"
  await (async () => {
    let calls = 0;
    const published: unknown[] = [];
    const controller = createApiResourceController(
      async () => {
        calls++;
        return { name: "Private saved view" };
      },
      (state) => published.push(state.data),
    );
    const disposed = createApiResourceController(
      async () => {
        assert.fail("a disposed paused mount cannot restart");
      },
      () => {},
    );
    try {
      privateReads.pause();
      await controller.refresh();
      await controller.refresh();
      await disposed.refresh();
      disposed.dispose();
      assert.equal(calls, 0);
      assert.deepEqual(published, []);
      privateReads.resume();
      await Promise.resolve();
      assert.equal(calls, 1);
      assert.deepEqual(published.at(-1), { name: "Private saved view" });
      privateReads.pause();
      privateReads.resume();
      await Promise.resolve();
      assert.equal(calls, 1, "resume retry is one-shot");
    } finally {
      controller.dispose();
      disposed.dispose();
      privateReads.resume();
    }
  })();
});
