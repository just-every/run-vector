import assert from "node:assert/strict";
import { test } from "node:test";
import { createReadLifecycle } from "../src/core/app/read-lifecycle.ts";
import { bindDocumentReadLifecycle } from "../src/core/app/document-read-lifecycle.ts";

function fixture() {
  const host = Object.assign(new EventTarget(), {
    navigation: Object.assign(new EventTarget(), {
      transition: null as null | { finished: Promise<void> },
    }),
    location: { reload() {} },
  });
  const reads = createReadLifecycle();
  const binding = bindDocumentReadLifecycle(host, reads);
  const dispose = () => binding.dispose();
  const navigate = (
    sameDocument = false,
    downloadRequest: string | null = null,
  ) => {
    const abort = new AbortController();
    host.navigation.dispatchEvent(
      Object.assign(new Event("navigate"), {
        destination: { sameDocument },
        signal: abort.signal,
        downloadRequest,
      }),
    );
    return abort;
  };
  return { host, reads, navigate, dispose, binding };
}

test("Document navigation admits private reads only for the live document", async (context) => {
  // Scenario: "document pause closes admission but admitted bodies still drain"
  await (async () => {
    const { reads, navigate, dispose } = fixture();
    let finish!: () => void;
    const body = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const admitted = reads.read("/api/held", () => body);
    navigate();
    let called = false;
    await assert.rejects(
      reads.read("/api/new", async () => {
        called = true;
      }),
    );
    assert.equal(called, false);
    await assert.rejects(
      reads.settle(5),
      /reads are still pending: \/api\/held/,
    );
    finish();
    await admitted;
    await reads.settle();
    assert.equal(
      reads.paused,
      true,
      "body completion does not reopen navigation",
    );
    dispose();
  })();
  // Scenario: "cancel, restore and successful interception release only their document pause"
  await (async () => {
    for (const recovery of ["cancel", "restore", "success"] as const) {
      const { reads, navigate, host, dispose } = fixture();
      let resumed = 0;
      reads.onResume(() => resumed++);
      reads.pause();
      const abort = navigate();
      if (recovery === "cancel") abort.abort();
      if (recovery === "restore")
        host.dispatchEvent(
          Object.assign(new Event("pageshow"), { persisted: true }),
        );
      if (recovery === "success")
        host.navigation.transition = { finished: Promise.resolve() };
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(
        reads.paused,
        true,
        recovery + " cannot revive a signed-out document",
      );
      assert.equal(resumed, 0);
      reads.resume();
      assert.equal(reads.paused, false);
      assert.equal(resumed, 1);
      abort.abort();
      await Promise.resolve();
      dispose();
      assert.equal(resumed, 1, "repeated release is inert");
    }
  })();
  // Scenario: "unobserved cancellation requests a fresh document without reopening any reads"
  await (() => {
    const { host, reads, binding, dispose } = fixture();
    let reloaded = 0;
    host.location.reload = () => {
      assert.equal(reads.paused, true);
      reloaded++;
    };
    host.dispatchEvent(new Event("beforeunload"));
    host.navigation.dispatchEvent(new Event("navigatesuccess"));
    assert.equal(
      binding.pending,
      true,
      "unrelated global success is no cancellation receipt",
    );
    reads.pause();
    binding.reload();
    assert.equal(reloaded, 0, "Reload cannot interrupt sign-out");
    assert.equal(reads.paused, true);
    reads.resume();
    assert.equal(reads.paused, true);
    binding.reload();
    assert.equal(reloaded, 1);
    assert.equal(
      reads.paused,
      true,
      "only the new document can initialize reads",
    );
    assert.equal(binding.pending, true);
    dispose();
  })();
  // Scenario: "manual sign-out failure cannot reopen an ongoing document navigation"
  await (async () => {
    const { reads, navigate, dispose } = fixture();
    reads.pause();
    const abort = navigate();
    reads.resume();
    assert.equal(reads.paused, true);
    abort.abort();
    await Promise.resolve();
    assert.equal(reads.paused, false);
    dispose();
  })();
  // Scenario: "beforeunload first transfers its lease to observable cancellation without a read gap"
  await (async () => {
    const { reads, host, navigate, binding, dispose } = fixture();
    let resumed = 0;
    reads.onResume(() => resumed++);
    host.dispatchEvent(new Event("beforeunload"));
    const abort = navigate();
    assert.equal(resumed, 0);
    abort.abort();
    await Promise.resolve();
    assert.equal(binding.pending, false);
    assert.equal(reads.paused, false);
    assert.equal(resumed, 1);
    dispose();
  })();
  // Scenario: "an aborted observed attempt cannot lend its queued-release fence to a browser replacement"
  await (async () => {
    const { reads, host, navigate, binding, dispose } = fixture();
    const observed = navigate();
    observed.abort();
    host.dispatchEvent(new Event("beforeunload"));
    await Promise.resolve();
    assert.equal(reads.paused, true);
    assert.equal(binding.pending, true);
    host.dispatchEvent(
      Object.assign(new Event("pageshow"), { persisted: true }),
    );
    assert.equal(reads.paused, false);
    dispose();
  })();
  // Scenario: "a failed explicit reload cannot revive its outgoing document after attempt cancellation"
  await (async () => {
    const { reads, host, navigate, binding, dispose } = fixture();
    host.dispatchEvent(new Event("beforeunload"));
    binding.reload();
    const replacement = navigate();
    host.dispatchEvent(new Event("beforeunload"));
    replacement.abort();
    await Promise.resolve();
    assert.equal(reads.paused, true);
    assert.equal(binding.pending, true);
    reads.pause();
    host.dispatchEvent(
      Object.assign(new Event("pageshow"), { persisted: true }),
    );
    assert.equal(
      reads.paused,
      true,
      "a restored document still cannot release sign-out",
    );
    reads.resume();
    assert.equal(reads.paused, false);
    dispose();
  })();
  // Scenario: "browsers without Navigation API retain beforeunload, explicit reload and BFCache recovery"
  await (() => {
    const host = Object.assign(new EventTarget(), {
      location: { reload() {} },
    });
    const reads = createReadLifecycle();
    const binding = bindDocumentReadLifecycle(host, reads);
    host.dispatchEvent(new Event("beforeunload"));
    assert.equal(reads.paused, true);
    binding.reload();
    assert.equal(
      reads.paused,
      true,
      "reload does not release the old document",
    );
    host.dispatchEvent(new Event("beforeunload"));
    host.dispatchEvent(
      Object.assign(new Event("pageshow"), { persisted: true }),
    );
    assert.equal(reads.paused, false);
    binding.dispose();
  })();
  // Scenario: "supersession does not admit queued reads between two document navigations"
  await (async () => {
    const { reads, navigate, dispose } = fixture();
    let resumed = 0;
    reads.onResume(() => resumed++);
    const first = navigate();
    first.abort();
    const second = navigate();
    await Promise.resolve();
    assert.equal(reads.paused, true);
    assert.equal(resumed, 0);
    second.abort();
    await Promise.resolve();
    assert.equal(reads.paused, false);
    assert.equal(resumed, 1);
    dispose();
  })();
  // Scenario: "same-document navigation and downloads keep ordinary reads; only persisted pageshow restores"
  await (async () => {
    const { reads, navigate, host, dispose } = fixture();
    navigate(true);
    navigate(false, "file.txt");
    assert.equal(await reads.read("/api/new", async () => 1), 1);
    navigate();
    host.dispatchEvent(
      Object.assign(new Event("pageshow"), { persisted: false }),
    );
    assert.equal(reads.paused, true);
    host.dispatchEvent(
      Object.assign(new Event("pageshow"), { persisted: true }),
    );
    assert.equal(await reads.read("/api/restored", async () => 2), 2);
    dispose();
    navigate();
    assert.equal(
      reads.paused,
      false,
      "disposed bindings stop observing navigation",
    );
  })();
});
