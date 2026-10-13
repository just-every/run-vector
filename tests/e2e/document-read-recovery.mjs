import assert from "node:assert/strict";
import { documentReadFixture } from "./document-read-fixture.mjs";
import { pressReloadDuringNavigation } from "./document-navigation-controls.mjs";
import { settleReads, trackRequests } from "./collaboration-navigation.mjs";

export async function assertNativeReadRecovery(browser, report) {
  const fixture = await documentReadFixture();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [],
    failed = [],
    frames = [];
  let outgoingNavigation;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame())
      frames.push({ path: new URL(frame.url()).pathname, time: Date.now() });
  });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
    if (m.text().startsWith("lifecycle:"))
      report.lifecycle.push({
        recovery: true,
        time: Date.now(),
        ...JSON.parse(m.text().slice(10)),
      });
  });
  page.on("requestfailed", (r) =>
    failed.push({
      path: new URL(r.url()).pathname,
      error: r.failure().errorText,
    }),
  );
  trackRequests(page);
  const pending = () =>
    page.waitForEvent("console", {
      predicate: (m) => m.text().includes('"type":"pending-ready"'),
    });
  async function reloadDocument(previous) {
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/app/recovery" &&
        r.request().isNavigationRequest(),
    );
    await pressReloadDuringNavigation(page);
    assert.equal(
      await (await response).finished(),
      null,
      "real reload document response fully completes",
    );
    await page.waitForFunction(
      (id) =>
        document.body.dataset.ready === "true" &&
        document.body.dataset.documentId !== id,
      previous,
    );
    await settleReads(page);
    assert.equal(await page.locator("#reload").isHidden(), true);
    return page.locator("body").getAttribute("data-document-id");
  }
  try {
    await page.goto(fixture.base + "/app/recovery");
    await page.waitForSelector('body[data-ready="true"]');
    await settleReads(page);
    let identity = await page.locator("body").getAttribute("data-document-id");
    const ready = pending();
    // No driver deadline can cancel the held navigation or explain recovery.
    outgoingNavigation = page
      .goto(fixture.base + "/app/next", { timeout: 0 })
      .then(
        () => ({ committed: true }),
        (error) => ({ error: error.message.split("\n")[0] }),
      );
    await fixture.requested;
    await ready;
    identity = await reloadDocument(identity);
    report.checks.push(
      "trusted keyboard reload completes a new original-route document while destination is held",
    );
    report.oldResponseReleasedAt = Date.now();
    fixture.releaseDocument();
    await Promise.race([fixture.documentClosed, fixture.documentSent]);
    const afterRelease = await page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/read" &&
        r.request().headers()["x-document-id"] === identity,
    );
    assert.equal(
      await afterRelease.finished(),
      null,
      "new document reads complete after the old response is released",
    );
    await settleReads(page);
    assert.equal(
      await page.locator("body").getAttribute("data-document-id"),
      identity,
    );
    assert.equal(new URL(page.url()).pathname, "/app/recovery");
    assert.equal(
      frames.some((f) => f.path === "/app/next"),
      false,
      "released old destination never commits",
    );
    report.checks.push(
      "late original destination response cannot replace the authenticated reload; native private reads complete",
    );

    let reads = Number(await page.locator("body").getAttribute("data-reads"));
    await page.evaluate(() =>
      history.pushState({}, "", "/app/recovery#same-document"),
    );
    await page.waitForFunction(
      (previous) => Number(document.body.dataset.reads) > previous,
      reads,
    );
    assert.equal(await page.locator("#reload").isHidden(), true);
    report.checks.push("same-document history keeps reading");
    reads = Number(await page.locator("body").getAttribute("data-reads"));
    await page.locator("#cancel").click();
    await page.waitForFunction(
      (previous) => Number(document.body.dataset.reads) > previous,
      reads,
    );
    assert.equal(await page.locator("#reload").isHidden(), true);
    report.checks.push(
      "native prevented navigation automatically releases only its document lease",
    );

    await settleReads(page);
    await page.evaluate(() =>
      document.dispatchEvent(new Event("fixture-pause")),
    );
    const manualReadCount = fixture.events.filter(
      (e) => e.type === "request" && e.path === "/api/read",
    ).length;
    await page.locator("#cancel").click();
    await page.waitForTimeout(250);
    assert.equal(
      fixture.events.filter(
        (e) => e.type === "request" && e.path === "/api/read",
      ).length,
      manualReadCount,
      "native cancellation never releases the production sign-out pause across multiple poll ticks",
    );
    const manualResumed = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/read",
    );
    await page.evaluate(() =>
      document.dispatchEvent(new Event("fixture-resume")),
    );
    assert.equal(await (await manualResumed).finished(), null);
    report.checks.push(
      "native navigation cancellation preserves the independent production sign-out pause",
    );

    const noContent = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/no-content",
    );
    const noContentPending = pending();
    await page.evaluate(() => {
      setTimeout(() => location.assign("/no-content"), 0);
    });
    assert.equal((await noContent).status(), 204);
    await noContentPending;
    identity = await reloadDocument(identity);
    report.checks.push(
      "204 no-commit recovery completes a fresh document and new private reads",
    );

    const cacheSession = await context.newCDPSession(page);
    await cacheSession.send("Page.enable");
    cacheSession.on("Page.backForwardCacheNotUsed", (event) => {
      report.cacheNotUsed = event.notRestoredExplanations;
    });
    await page.goto(fixture.base + "/app/cache");
    await page.waitForSelector('body[data-ready="true"]');
    await settleReads(page);
    await page.goBack({ waitUntil: "commit" });
    await page.waitForSelector('body[data-restored="true"]');
    assert.equal(
      await page.locator("body").getAttribute("data-document-id"),
      identity,
    );
    reads = Number(await page.locator("body").getAttribute("data-reads"));
    await page.waitForFunction(
      (previous) => Number(document.body.dataset.reads) > previous,
      reads,
    );
    await settleReads(page);
    assert.equal(await page.locator("#reload").isHidden(), true);
    report.checks.push(
      "native BFCache restoration resumes the original document's private reads",
    );
    await cacheSession.detach();
    assert.deepEqual(errors, []);
    assert.deepEqual(
      failed,
      [
        { path: "/app/next", error: "net::ERR_ABORTED" },
        { path: "/no-content", error: "net::ERR_ABORTED" },
      ],
      "only the superseded destination and confirmed 204 no-document response abort",
    );
  } finally {
    report.recoveryFailures = failed;
    report.recoveryEvents = fixture.events;
    report.recoveryFrames = frames;
    await context.close();
    report.supersededNavigationDriver = await outgoingNavigation;
    await fixture.close();
  }
}
