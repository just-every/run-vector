import assert from "node:assert/strict";
import {
  beforePrivateNavigation,
  navigate,
  settleReads,
  trackRequests,
} from "./collaboration-navigation.mjs";
import { signInRecoverySession } from "./document-read-session.mjs";

// This page has its own strict diagnostics: only its deliberately stopped
// document request can abort. Existing administration diagnostics are intact.
export async function assertDocumentReadRecovery({
  page: owner,
  runtime,
  clause,
  capturePage,
}) {
  const context = await owner
    .context()
    .browser()
    .newContext({ viewport: owner.viewportSize() });
  const page = await context.newPage();
  trackRequests(page);
  const errors = [],
    failed = [],
    badResponses = [],
    routeErrors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("requestfailed", (r) =>
    failed.push({
      path: new URL(r.url()).pathname,
      method: r.method(),
      error: r.failure().errorText,
    }),
  );
  page.on("response", (r) => {
    if (r.status() >= 400)
      badResponses.push([new URL(r.url()).pathname, r.status()]);
  });
  const capture = capturePage(page);
  let release, session;
  try {
    await clause(
      "BASE-ACCESS-002",
      "document departure fences private polls and explicit reload starts a newly authenticated document",
      async () => {
        await signInRecoverySession(page, runtime);
        await navigate(page, runtime.base + "/app/settings");
        await page
          .getByRole("heading", { name: "Settings", exact: true })
          .waitFor();
        await settleReads(page);
        const original = page.url();
        const originalTimeOrigin = await page.evaluate(
          () => performance.timeOrigin,
        );
        let requested, forwarded;
        const held = new Promise((resolve) => {
          requested = resolve;
        });
        const done = new Promise((resolve) => {
          forwarded = resolve;
        });
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        const target = runtime.base + "/app/inbox";
        await page.route(target, async (route) => {
          requested();
          await gate;
          try {
            await route.continue();
          } catch (error) {
            routeErrors.push(error.message.split("\n")[0]);
          } finally {
            forwarded();
          }
        });
        session = await page.context().newCDPSession(page);
        let admissionClosed = false;
        const afterDeparture = [];
        page.on("request", (r) => {
          if (
            admissionClosed &&
            r.method() === "GET" &&
            new URL(r.url()).pathname.startsWith("/api/")
          )
            afterDeparture.push(new URL(r.url()).pathname);
        });
        // The Settings heading is server-rendered; finish hydrated native reads
        // before testing departure so Stop only cancels the held document.
        await beforePrivateNavigation(page, target);
        const navigation = page
          .goto(target, { waitUntil: "commit", timeout: 3000 })
          .then(
            () => ({ committed: true }),
            (error) => ({ error: error.message.split("\n")[0] }),
          );
        await held;
        admissionClosed = true;
        // Native browser Stop has no page cancellation event. The application
        // must retain its pending lease and offer an explicit fresh document.
        await session.send("Page.stopLoading");
        await navigation;
        release();
        await done;
        await page.unroute(target);
        assert.equal(page.url(), original);
        await page
          .getByRole("status")
          .filter({ hasText: "Opening another page…" })
          .waitFor();
        const pending = await capture("document-navigation-pending");
        assert.ok(pending, "pending document recovery has a functional checkpoint");
        assert.deepEqual(
          afterDeparture,
          [],
          "no private GET starts while browser departure remains unresolved",
        );
        const reloaded = page.waitForResponse(
          (r) => r.url() === original && r.request().isNavigationRequest(),
        );
        const resumed = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/api/notifications/count" &&
            r.status() === 200,
        );
        admissionClosed = false;
        await page
          .getByRole("button", { name: "Reload this page", exact: true })
          .focus();
        await page.keyboard.press("Enter");
        assert.equal(
          await (await reloaded).finished(),
          null,
          "authenticated reload document finishes natively",
        );
        assert.equal(
          await (await resumed).finished(),
          null,
          "resumed private response finishes natively",
        );
        await settleReads(page);
        assert.equal(
          page.url(),
          original,
          "explicit reload returns to the original private route",
        );
        assert.notEqual(
          await page.evaluate(() => performance.timeOrigin),
          originalTimeOrigin,
          "reads restart only in a fresh authenticated document",
        );
        assert.equal(
          await page
            .getByRole("button", { name: "Reload this page", exact: true })
            .count(),
          0,
        );
        const recovered = await capture("document-navigation-reloaded");
        assert.ok(recovered, "recovered document has a functional checkpoint");
        let signoutRequested, signoutForwarded;
        const signoutHeld = new Promise((resolve) => {
          signoutRequested = resolve;
        });
        const signoutDone = new Promise((resolve) => {
          signoutForwarded = resolve;
        });
        const signoutGate = new Promise((resolve) => {
          release = resolve;
        });
        await page.route(target, async (route) => {
          signoutRequested();
          await signoutGate;
          try {
            await route.continue();
          } catch (error) {
            routeErrors.push(error.message.split("\n")[0]);
          } finally {
            signoutForwarded();
          }
        });
        await beforePrivateNavigation(page, target);
        const signoutNavigation = page
          .goto(target, { waitUntil: "commit", timeout: 3000 })
          .catch((error) => error.message.split("\n")[0]);
        await signoutHeld;
        await session.send("Page.stopLoading");
        await signoutNavigation;
        release();
        await signoutDone;
        await page.unroute(target);
        await page
          .getByRole("button", { name: "Reload this page", exact: true })
          .waitFor();
        const revoke = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/auth/signout" &&
            r.request().method() === "POST",
        );
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .filter({ visible: true })
          .click();
        assert.equal(
          (await revoke).status(),
          200,
          "pending navigation permits independent real sign-out",
        );
        await page.waitForURL(runtime.base + "/signin");
        assert.equal(await page.locator(".app-shell").count(), 0);
        assert.equal(
          await page
            .getByRole("button", { name: "Reload this page", exact: true })
            .count(),
          0,
        );
        assert.ok(await capture("document-navigation-signed-out"));
        assert.deepEqual(errors, [], "no recovery page or console errors");
        assert.deepEqual(
          badResponses,
          [],
          "no failed HTTP or module responses",
        );
        assert.deepEqual(
          routeErrors,
          [],
          "held real document transport completed cleanly",
        );
        assert.ok(
          failed.length <= 2 &&
            failed.every(
              (r) =>
                r.path === "/app/inbox" &&
                r.method === "GET" &&
                r.error === "net::ERR_ABORTED",
            ),
          "only the intentionally stopped native document may abort",
        );
      },
    );
  } finally {
    release?.();
    await session?.detach();
    await context.close();
  }
}
