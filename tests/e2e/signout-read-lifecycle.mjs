import assert from "node:assert/strict";
import { settleReads, trackRequests } from "./collaboration-navigation.mjs";
import { auditSignOutReads, clickSignOut } from "./signout-read-audit.mjs";
import { fetchHeld } from "./route-fetch.mjs";

// The transport is held before forwarding to the real Worker. No response is
// fabricated: it must still authorize and complete before sign-out is sent.
export async function assertSignOutReadLifecycle({
  page: ownerPage,
  runtime,
  clause,
  capturePage,
}) {
  const page = await ownerPage.context().newPage();
  const privateAfterClick = await auditSignOutReads(page);
  const capture = capturePage?.(page);
  const capturedStates = [];
  const expectedCaptures = [
    "signout-paused-private-read",
    "signout-read-deadline-retry",
    "signout-complete-private-ui-removed",
  ];
  async function captureState(name) {
    if (!capture) return;
    // Do not await network idle: the private request is deliberately held.
    const receipt = await capture(name);
    assert.ok(receipt, name + ": functional checkpoint exists");
    capturedStates.push(name);
  }
  const errors = [],
    consoleErrors = [],
    failed = [],
    modules = [];
  const routeErrors = [];
  const forward = async (route) => {
    try {
      await route.continue();
    } catch (error) {
      routeErrors.push(error.message);
    }
  };
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) =>
    failed.push(new URL(request.url()).pathname),
  );
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      response.request().resourceType() === "script"
    )
      modules.push(new URL(response.url()).pathname);
  });
  try {
    await clause(
      "BASE-ACCESS-002",
      "sign-out drains private reads before revocation and resumes after a bounded failure",
      async () => {
        const { base } = runtime;
        await page.goto(base + "/signin");
        await page
          .getByLabel("Email", { exact: true })
          .fill(runtime.config.FIRST_OWNER_EMAIL);
        const sent = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/auth/request" &&
            r.request().method() === "POST",
        );
        await page
          .getByRole("button", { name: "Send sign-in link", exact: true })
          .click();
        assert.equal((await sent).status(), 202);
        const link = runtime.sql(
          "SELECT json_extract(message,'$.text') AS sign_in_url FROM rer_mail_development_outbox ORDER BY created_at DESC,sequence DESC LIMIT 1",
        )[0].sign_in_url.match(/https?:\/\/[^\s]+/)[0];
        await page.goto(link);
        await page
          .getByRole("button", { name: "Confirm", exact: true })
          .click();
        await page.waitForURL(base + "/app");
        trackRequests(page);
        await settleReads(page);
        await assertUnexpectedReadFailure(page, base);
        let release;
        let held;
        const admitted = new Promise((resolve) => {
          held = resolve;
        });
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        let holding = true;
        const routeHandler = async (route) => {
          if (holding && route.request().method() === "GET") {
            holding = false;
            held(route.request());
            await gate;
          }
          await forward(route);
        };
        let signouts = 0;
        const observe = (request) => {
          const path = new URL(request.url()).pathname;
          if (path === "/auth/signout") signouts++;
        };
        page.on("request", observe);
        await page.route("**/api/refresh?**", routeHandler);
        try {
          const request = await admittedRead(admitted);
          await assert.rejects(
            settleReads(page, 50),
            /reads still pending before navigation:.*\/api\/refresh/,
            "a native held GET fails navigation readiness at its deadline",
          );
          const firstAttempt = await clickSignOut(page);
          assert.equal(firstAttempt, 1);
          assert.equal(
            await page.locator(".app-shell").getAttribute("inert"),
            "",
          );
          await captureState("signout-paused-private-read");
          assert.equal(
            await page.locator(".app-shell").getAttribute("inert"),
            "",
            "pause capture completed while sign-out was still draining",
          );
          // This exceeds the Current’s two-second poll period, proving admission is
          // fenced rather than merely relying on luck between polling ticks.
          await page.waitForTimeout(2200);
          assert.equal(signouts, 0, "revocation waits for admitted real GET");
          assert.deepEqual(
            privateAfterClick(firstAttempt),
            [],
            "no fresh private polls while sign-out drains",
          );
          await page
            .getByRole("alert")
            .filter({
              hasText: /reads are still pending:.*\/api\/refresh/,
            })
            .waitFor({ timeout: 12000 });
          assert.equal(
            signouts,
            0,
            "a drain deadline must not revoke the session",
          );
          assert.equal(
            await page
              .getByRole("button", { name: "Sign out", exact: true })
              .filter({ visible: true })
              .isEnabled(),
            true,
          );
          await captureState("signout-read-deadline-retry");
          const resumed = page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === "/api/current" &&
              r.status() === 200,
          );
          await resumed;
          const finished = page.waitForEvent("requestfinished", {
            predicate: (r) => r === request,
          });
          release();
          await finished;
          await settleReads(page);
          holding = true;
          // A second held read demonstrates the success boundary, after recovery.
          let resolveSecond;
          const second = new Promise((resolve) => {
            resolveSecond = resolve;
          });
          let releaseSecond;
          const secondGate = new Promise((resolve) => {
            releaseSecond = resolve;
          });
          await page.unroute("**/api/refresh?**", routeHandler);
          const secondHandler = async (route) => {
            if (holding) {
              holding = false;
              resolveSecond(route.request());
              await secondGate;
            }
            await forward(route);
          };
          await page.route("**/api/refresh?**", secondHandler);
          try {
            const secondRequest = await admittedRead(second);
            const secondAttempt = await clickSignOut(page);
            assert.equal(secondAttempt, 2);
            await page.waitForTimeout(2200);
            assert.equal(
              signouts,
              0,
              "recovered sign-out still waits for private GET",
            );
            assert.deepEqual(privateAfterClick(secondAttempt), []);
            let readFinished = false;
            const markFinished = (r) => {
              if (r === secondRequest) readFinished = true;
            };
            page.on("requestfinished", markFinished);
            const revoke = page.waitForRequest(
              (r) => new URL(r.url()).pathname === "/auth/signout",
            );
            releaseSecond();
            await revoke;
            assert.equal(
              readFinished,
              true,
              "GET response completed before revocation POST",
            );
            await page.waitForURL(base + "/signin");
            assert.equal(signouts, 1);
            assert.deepEqual(
              privateAfterClick(secondAttempt),
              [],
              "no private GET starts across the revocation boundary",
            );
            assert.equal(
              (await page.request.get(base + "/api/session")).status(),
              401,
            );
            assert.equal(
              await page.locator(".app-shell").count(),
              0,
              "private UI removed after sign-out",
            );
            await captureState("signout-complete-private-ui-removed");
            page.off("requestfinished", markFinished);
          } finally {
            releaseSecond();
            await page.unroute("**/api/refresh?**", secondHandler);
          }
        } finally {
          release();
          page.off("request", observe);
          await page.unroute("**/api/refresh?**", routeHandler);
        }
      },
    );
    if (capture)
      assert.deepEqual(
        capturedStates,
        expectedCaptures,
        "all three sign-out lifecycle states used the functional checkpoint",
      );
    assert.deepEqual(errors, [], "sign-out lifecycle page errors");
    assert.deepEqual(consoleErrors, [], "unexpected browser console errors");
    assert.deepEqual(failed, [], "sign-out lifecycle failed requests");
    assert.deepEqual(modules, [], "sign-out lifecycle failed modules");
    assert.deepEqual(
      routeErrors,
      [],
      "held native routes completed without transport errors",
    );
  } finally {
    await page.close();
    await ownerPage.bringToFront();
  }
}

async function admittedRead(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error("Native refresh batch did not start within 15 seconds"),
            ),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// A separate test page intentionally receives HTTP 500. The ordinary page's
// zero-error assertions remain untouched; the same assertion must reject this
// page's real browser console diagnostic, and its UI must show the failure.
async function assertUnexpectedReadFailure(page, base) {
  const probe = await page.context().newPage();
  const errors = [];
  probe.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await probe.route("**/api/refresh?**", async (route) => {
    const response = await fetchHeld(route);
    assert.equal(
      response.status(),
      200,
      "fault fixture starts from an authorized native read",
    );
    await route.fulfill({ response, status: 500 });
  });
  try {
    await probe.goto(base + "/app");
    await probe
      .getByLabel("Unread count unavailable", { exact: true })
      .filter({ visible: true })
      .first()
      .waitFor();
    assert.ok(
      errors.some((error) => /500/.test(error)),
      "unexpected HTTP 500 remains a browser error before sign-out",
    );
    assert.throws(
      () => assert.deepEqual(errors, [], "unexpected browser console errors"),
      /unexpected browser console errors/,
    );
    await settleReads(probe);
  } finally {
    await probe.close();
    await page.bringToFront();
  }
}
