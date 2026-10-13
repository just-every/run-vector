import { confirmLink } from './outbox-session.mjs';
import assert from "node:assert/strict";
import { auditProofState } from "./ui-proof-state.mjs";
import { openAuthenticatedPage } from "./ui-runtime-auth.mjs";
import { fetchHeld } from "./route-fetch.mjs";

export async function auditReviewCollaboration({
  page,
  base,
  req,
  sql,
  opts,
  headers,
  browser,
  runCase = async (_name, run) => run(),
}) {
  const recipient = opts.operators.find(
    (operator) => operator.id !== opts.operator.id,
  );
  assert.ok(recipient, "real second operator exists");
  const email = sql(`SELECT email FROM operators WHERE id='${recipient.id}'`)[0]
    .email;
  const request = await req("/auth/request", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email, returnTo: "/app" }),
  });
  assert.equal(request.status, 202);
  const url = sql(
    `SELECT json_extract(message,'$.text') AS sign_in_url FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='${email}' ORDER BY created_at DESC,sequence DESC LIMIT 1`,
  )[0].sign_in_url.match(/https?:\/\/[^\s]+/)[0];
  const signed = await confirmLink(url);
  assert.equal(signed.status, 303);
  const peer = await openAuthenticatedPage(
    browser,
    signed.headers.get("set-cookie").split(";")[0],
    base,
  );
  peer.setDefaultTimeout(
    process.env.VECTOR_BASELINE_PROOF === "1" ? 4000 : 15000,
  );
  try {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await peer.setViewportSize(page.viewportSize());
      const create = await req("/api/issues", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `Readable mentions ${width}`,
          teamId: opts.teams[0].id,
        }),
      });
      assert.equal(create.status, 201);
      const issue = await create.json();
      await runCase(`${width}-mention-picker`, async () => {
        await page.goto(`${base}/app/issues/${issue.identifier}`);
        const editor = page.getByRole("textbox", {
          name: "Add a comment",
          exact: true,
        });
        await editor.fill("Please review ");
        await editor.press("End");
        await editor.pressSequentially("@" + recipient.name.split(" ")[0]);
        const option = page
          .getByRole("listbox", { name: "Mention an operator", exact: true })
          .getByRole("option", { name: new RegExp(recipient.name) });
        await option.waitFor();
        const secondary = await option.locator("small").allTextContents();
        assert.ok(
          secondary.every((text) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim()),
          ),
          "suggestion secondary identity is absent or an email",
        );
        assert.doesNotMatch(
          await option.textContent(),
          /Operator\s+\d|[A-Z0-9]{26}/,
          "mention picker presents human identity",
        );
        await auditProofState(page, `${width}-mention-picker`);
        await editor.press("Enter");
        assert.match(
          await editor.getAttribute("data-canonical-body"),
          /@\{[A-Z0-9]{26}\|/,
          "keyboard selection retains stable identity",
        );
      });
      // Persist a real canonical mention separately so presentation tests still
      // execute when the earlier picker assertion fails on the baseline.
      const comment = await req(`/api/issues/${issue.identifier}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          body: `Please review @{${recipient.id}|${encodeURIComponent(recipient.name).replace(/[!'()*]/g, (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase())}}`,
        }),
      });
      assert.equal(comment.status, 201);
      await runCase(`${width}-posted-mention`, async () => {
        await page.goto(`${base}/app/issues/${issue.identifier}`);
        const entry = page.locator(".comment-entry").last();
        await entry.waitFor();
        const chip = entry.locator(".mention-chip");
        await chip.waitFor();
        assert.equal(await chip.textContent(), "@" + recipient.name);
        assert.ok(
          await chip.evaluate((node) => {
            const s = getComputedStyle(node);
            return (
              parseFloat(s.paddingLeft) > 0 &&
              !["transparent", "rgba(0, 0, 0, 0)"].includes(s.backgroundColor)
            );
          }),
          "posted mention has a chip surface",
        );
        const time = entry.locator("time").first();
        assert.match(await time.textContent(), /^(just now|\d+[mhd] ago)$/);
        assert.ok(await time.getAttribute("datetime"));
        await entry
          .getByText("Attach link to this comment", { exact: true })
          .waitFor();
        assert.equal(
          await page
            .locator(".named-links")
            .filter({ hasNot: page.locator(".comment-entry") })
            .getByText("Attach link", { exact: true })
            .count(),
          1,
          "separate issue-level attachment remains named Attach link",
        );
        await auditProofState(page, `${width}-posted-mention`);
      });
      await runCase(`${width}-inbox-readable-row`, async () => {
        await peer.goto(base + "/app/inbox");
        const row = peer
          .locator(".inbox-row")
          .filter({ hasText: issue.identifier });
        await row.waitFor();
        const identifier = row.locator("strong");
        assert.equal(
          await identifier.evaluate(
            (node) => getComputedStyle(node).whiteSpace,
          ),
          "nowrap",
        );
        const time = row.locator("time");
        assert.match(await time.textContent(), /^(just now|\d+[mhd] ago)$/);
        assert.ok(await time.getAttribute("datetime"));
        await auditProofState(peer, `${width}-inbox-readable-row`);
      });
    }
    for (const width of [1440, 390])
      await runCase(`${width}-empty-inbox-count-loading`, async () => {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 900,
        });
        let release, observed;
        const blocked = new Promise((resolve) => {
          release = resolve;
        });
        const countFetched = new Promise((resolve) => {
          observed = resolve;
        });
        const deliveries = [],
          routeErrors = [];
        await page.route("**/api/notifications/count", async (route) => {
          const delivery = (async () => {
            const response = await fetchHeld(route);
            observed(response.status());
            await blocked;
            await route.fulfill({ response });
          })().catch((error) => routeErrors.push(error.message));
          deliveries.push(delivery);
          await delivery;
        });
        try {
          await page.goto(base + "/app/inbox");
          await page.getByText("Nothing new.", { exact: true }).waitFor();
          assert.equal(
            await countFetched,
            200,
            "held count is the actual successful server response",
          );
          assert.equal(
            await page
              .getByRole("button", { name: "Mark all read", exact: true })
              .isDisabled(),
            true,
            "empty inbox stays disabled while unread count is unavailable",
          );
          await auditProofState(page, `${width}-empty-inbox-count-loading`);
        } finally {
          release();
          await Promise.all(deliveries);
          await page.unroute("**/api/notifications/count");
          assert.deepEqual(
            routeErrors,
            [],
            "held actual count responses are delivered without interception errors",
          );
        }
      });
    // The author's inbox is empty: their own comment never notifies them.
    for (const width of [1440, 390])
      await runCase(`${width}-inbox-empty`, async () => {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 900,
        });
        await page.goto(base + "/app/inbox");
        await page
          .getByText(/Assignments and mentions will appear here/)
          .waitFor();
        assert.equal(
          await page.locator(".inbox-row").count(),
          0,
          "empty Inbox has no notification rows",
        );
        assert.equal(
          await page
            .getByRole("button", { name: "Mark all read", exact: true })
            .isDisabled(),
          true,
        );
        await auditProofState(page, `${width}-inbox-empty`);
      });
  } finally {
    await peer.context().close();
  }
}
