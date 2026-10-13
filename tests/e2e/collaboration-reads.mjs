import { navigate } from "./collaboration-navigation.mjs";
import assert from "node:assert/strict";
import { counts, receipt } from "./collaboration-support.mjs";
export async function collaborationReads({
  peer,
  runtime,
  issue,
  operator,
  peerCapture,
  clause,
  path,
  owner,
}) {
  await clause(
    "NOTIFY-003",
    "recipient comments suppress self and preserve issue version",
    async () => {
      const before = counts(runtime, issue, operator);
      const version = runtime.sql(
        `SELECT version FROM issues WHERE id='${issue.id}'`,
      )[0].version;
      await navigate(peer, runtime.base + "/app/issues/" + issue.identifier);
      await peer
        .getByLabel("Add a comment", { exact: true })
        .fill("Recipient-authored comment suppresses self.");
      await receipt(peer, path + "/comments", "POST", () =>
        peer.getByRole("button", { name: "Add comment", exact: true }).click(),
      );
      assert.deepEqual(counts(runtime, issue, operator), before);
      assert.equal(
        runtime.sql(`SELECT version FROM issues WHERE id='${issue.id}'`)[0]
          .version,
        version,
        "comments leave issue version unchanged",
      );
      await peerCapture("recipient-comment-self-suppressed");
      await navigate(peer, runtime.base + "/app/inbox");
    },
  );
  await clause(
    "NOTIFY-003",
    "row opening and mark all are private version-neutral reads",
    async () => {
      const version = runtime.sql(
        `SELECT version FROM issues WHERE id='${issue.id}'`,
      )[0].version;
      const actorRow = runtime.sql(
        `SELECT * FROM notifications WHERE recipient_id='${owner.id}'`,
      )[0];
      assert.ok(
        actorRow,
        "recipient comment generated the other operator history",
      );
      const ownPage = await (
        await peer.request.get(runtime.base + "/api/notifications")
      ).json();
      assert.ok(
        ownPage.items.every((item) => item.id !== actorRow.id),
        "own API never projects other recipient rows",
      );
      const otherRead = await peer.request.post(
        runtime.base + `/api/notifications/${actorRow.id}/read`,
        {
          headers: { Origin: runtime.base, "Content-Type": "application/json" },
          data: {},
        },
      );
      assert.equal(
        otherRead.status(),
        404,
        "guessed other recipient read rejected",
      );
      assert.equal(
        runtime.sql(
          `SELECT read_at FROM notifications WHERE id='${actorRow.id}'`,
        )[0].read_at,
        null,
      );
      const opened = peer.waitForResponse(
        (r) =>
          /\/api\/notifications\/[^/]+\/read$/.test(
            new URL(r.url()).pathname,
          ) && r.request().method() === "POST",
      );
      await peer.locator(".inbox-row").first().click();
      assert.equal(
        (await opened).status(),
        200,
        "native Inbox row read accepted",
      );
      await peer.waitForURL(runtime.base + "/app/issues/" + issue.identifier);
      const remainingUnread = runtime.sql(
        `SELECT count(*) n FROM notifications WHERE recipient_id='${operator.id}' AND read_at IS NULL`,
      )[0].n;
      if (remainingUnread > 0)
        await peer
          .locator(".inbox-count:visible")
          .filter({ hasText: String(remainingUnread) })
          .waitFor();
      else
        await peer.locator(".inbox-count:visible").waitFor({ state: "hidden" });
      if (remainingUnread > 0)
        assert.equal(
          await peer.locator(".inbox-count:visible").getAttribute("aria-label"),
          `${remainingUnread} unread`,
          "visible navigation unread badge follows opening a row",
        );
      assert.equal(
        runtime.sql(
          `SELECT count(*) n FROM notifications WHERE recipient_id='${operator.id}' AND read_at IS NOT NULL`,
        )[0].n,
        1,
      );
      await navigate(peer, runtime.base + "/app/inbox");
      await receipt(peer, "/api/notifications/read-all", "POST", () =>
        peer
          .getByRole("button", { name: "Mark all read", exact: true })
          .click(),
      );
      await peer.getByText("0 unread", { exact: true }).waitFor();
      assert.equal(
        await peer.locator(".inbox-count").count(),
        0,
        "mark all read clears both navigation badges",
      );
      assert.equal(
        runtime.sql(`SELECT version FROM issues WHERE id='${issue.id}'`)[0]
          .version,
        version,
      );
      await peerCapture("inbox-all-read");
    },
  );
}
