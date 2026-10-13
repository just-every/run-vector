import assert from "node:assert/strict";
import { settingsRead, preferencesRead } from "./setup-guidance-controls.mjs";
import { inboxSchema } from "../../src/core/features/notifications/ui/data.ts";
import { openGate } from "./dev-gate.mjs";

export async function capturedLink(browser, base, email) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const outbox = await context.newPage();
    await openGate(context, base);
    assert.equal((await outbox.goto(base + "/__dev/outbox")).status(), 200);
    const message = outbox
      .locator("article")
      .filter({ hasText: email })
      .first();
    await message
      .getByRole("link", { name: "Read message", exact: true })
      .click();
    const href = await outbox
      .getByRole("link", { name: "Open this link", exact: true })
      .getAttribute("href");
    assert.equal(new URL(href).origin, base);
    assert.equal(new URL(href).pathname, "/auth/confirm");
    return href;
  } finally {
    await context.close();
  }
}
export async function requestLink(page, browser, base, email) {
  await page.goto(base + "/signin");
  await page.getByLabel("Email", { exact: true }).fill(email);
  const receipt = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/auth/request" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Send sign-in link", exact: true })
    .click();
  assert.equal((await receipt).status(), 202);
  return capturedLink(browser, base, email);
}
export async function confirmNative(page, link, runtime, hosted = false) {
  const before = (await runtime.rows("SELECT count(*) n FROM oa_sessions"))[0]
    .n;
  assert.equal((await page.goto(link)).status(), 200);
  assert.equal(
    (await runtime.rows("SELECT count(*) n FROM oa_sessions"))[0].n,
    before,
    "GET preview does not create a session",
  );
  const confirmation = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/auth/confirm" &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  assert.equal((await confirmation).status(), 303);
  await page.waitForURL(runtime.base + "/app");
  assert.equal(
    (await runtime.rows("SELECT count(*) n FROM oa_sessions"))[0].n,
    before + 1,
  );
  const cookies = await page.context().cookies();
  assert.ok(
    cookies.some(
      (row) =>
        row.name ===
          (hosted ? "__Host-operator_session" : "operator_session_local_" + new URL(runtime.base).port) &&
        row.httpOnly &&
        row.secure,
    ),
  );
}
export async function inviteNative(owner, peer, browser, runtime) {
  const response = await owner.request.post(
    runtime.base + "/api/settings/operators/invite",
    {
      headers: { Origin: runtime.base },
      data: { email: "recipient@setup.test", displayName: "Setup recipient" },
    },
  );
  assert.equal(response.status(), 202);
  await confirmNative(
    peer,
    await capturedLink(browser, runtime.base, "recipient@setup.test"),
    runtime,
  );
}
export async function eligibleAssignment(
  owner,
  peer,
  browser,
  runtime,
  expectedCapture,
) {
  await peer.goto(runtime.base + "/app/settings");
  const recipient = await settingsRead(peer);
  const preferences = await preferencesRead(peer);
  assert.equal(
    preferences.emailEnabled,
    true,
    "recipient permits assignment mail",
  );
  assert.equal(preferences.emailAvailable, expectedCapture);
  assert.deepEqual(preferences.mutedKinds, []);
  const actor = await settingsRead(owner);
  assert.notEqual(actor.operatorId, recipient.operatorId);
  const before = (
    await runtime.rows("SELECT count(*) n FROM rer_mail_development_outbox")
  )[0].n;
  const outbound = runtime.attempts();
  const options = await owner.request.get(runtime.base + "/api/options");
  assert.equal(options.status(), 200);
  const created = await owner.request.post(runtime.base + "/api/issues", {
    headers: { Origin: runtime.base },
    data: {
      title: `Setup assignment ${expectedCapture ? "captured" : "disabled"}`,
      teamId: (await options.json()).teams[0].id,
      assigneeOperatorId: recipient.operatorId,
    },
  });
  assert.equal(created.status(), 201);
  const issue = await created.json();
  const response = await peer.request.get(runtime.base + "/api/notifications");
  assert.equal(response.status(), 200);
  const notification = inboxSchema
    .parse(await response.json())
    .items.find((row) => row.identifier === issue.identifier);
  assert.ok(
    notification?.causes.includes("assignment"),
    "distinct admitted recipient receives the assignment in their inbox",
  );
  const after = (
    await runtime.rows("SELECT count(*) n FROM rer_mail_development_outbox")
  )[0].n;
  assert.equal(after - before, expectedCapture ? 1 : 0);
  const deliveries = await runtime.rows(
    `SELECT status,attempts FROM notification_deliveries WHERE identifier='${issue.identifier}'`,
  );
  if (expectedCapture) {
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].status, "development");
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const outbox = await context.newPage();
      await openGate(context, runtime.base);
      await outbox.goto(runtime.base + "/__dev/outbox");
      const message = outbox
        .locator("article")
        .filter({ hasText: issue.identifier });
      assert.equal(await message.count(), 1);
      assert.match(await message.textContent(), /recipient@setup\.test/);
    } finally {
      await context.close();
    }
  } else
    assert.ok(
      deliveries.every(
        (row) =>
          !["accepted", "development", "claimed", "uncertain"].includes(
            row.status,
          ),
      ),
    );
  assert.equal(
    runtime.attempts(),
    outbound,
    "eligible event causes no provider request",
  );
  return {
    identifier: issue.identifier,
    inbox: true,
    captures: after - before,
    outboundAttempts: runtime.attempts() - outbound,
  };
}
