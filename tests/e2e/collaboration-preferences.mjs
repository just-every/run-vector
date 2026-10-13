import { navigate } from "./collaboration-navigation.mjs";
import assert from "node:assert/strict";
import { poll } from "./admin-runtime-support.mjs";
import { counts, ownSubscription, receipt } from "./collaboration-support.mjs";
export async function collaborationPreferences({
  page,
  peer,
  runtime,
  issue,
  operator,
  capture,
  peerCapture,
  clause,
  comment,
  owner,
}) {
  await clause(
    "ISSUE-006",
    "own unfollow and follow preserve issue version",
    async () => {
      await navigate(peer, runtime.base + "/app/issues/" + issue.identifier);
      await ownSubscription(peer, runtime, issue.identifier, "Unfollow");
      await ownSubscription(peer, runtime, issue.identifier, "Follow");
      await peerCapture("issue-follow-restored");
    },
  );
  await clause(
    "NOTIFY-004",
    "issue and event mutes suppress future inbox and actual mail; unmute never backfills",
    async () => {
      await ownSubscription(peer, runtime, issue.identifier, "Mute");
      const before = counts(runtime, issue, operator);
      await peerCapture("issue-muted");
      await comment("Muted private comment ", true);
      await peer.waitForTimeout(2300);
      assert.deepEqual(counts(runtime, issue, operator), before);
      assert.equal(
        runtime.sql("SELECT count(*) n FROM notification_deliveries")[0].n,
        4,
        "muted action creates no mail intent",
      );
      await navigate(peer, runtime.base + "/app/settings");
      await peer
        .getByRole("region", { name: "Notifications", exact: true })
        .getByRole("button", {
          name: "Unmute " + issue.identifier,
          exact: true,
        })
        .click();
      await poll(
        () =>
          runtime.sql(
            `SELECT count(*) n FROM issue_notification_mutes WHERE operator_id='${operator.id}'`,
          ),
        (r) => r[0].n === 0,
        "unmute",
      );
      assert.deepEqual(counts(runtime, issue, operator), before);
      await peerCapture("settings-unmuted-no-backfill");
      const preferences = peer.getByRole("region", {
        name: "Notifications",
        exact: true,
      });
      for (const label of ["Mentions", "Followed comments"])
        await receipt(peer, "/api/settings/notifications", "PATCH", () =>
          preferences.getByLabel(label, { exact: true }).click(),
        );
      for (const label of ["Mentions", "Followed comments"])
        await poll(
          () => preferences.getByLabel(label, { exact: true }).isChecked(),
          (checked) => checked,
          "event mute control checked",
        );
      await peerCapture("settings-event-mutes");
      await comment("Event muted private comment ", true);
      await peer.waitForTimeout(2300);
      assert.deepEqual(counts(runtime, issue, operator), before);
      assert.equal(
        runtime.sql("SELECT count(*) n FROM notification_deliveries")[0].n,
        4,
        "muted action creates no mail intent",
      );
      for (const label of ["Mentions", "Followed comments"])
        await receipt(peer, "/api/settings/notifications", "PATCH", () =>
          preferences.getByLabel(label, { exact: true }).click(),
        );
      for (const label of ["Mentions", "Followed comments"])
        await poll(
          () => preferences.getByLabel(label, { exact: true }).isChecked(),
          (checked) => !checked,
          "event mute control unchecked",
        );
      assert.deepEqual(counts(runtime, issue, operator), before);
      await peerCapture("settings-event-unmuted-no-backfill");
    },
  );
  await clause(
    "NOTIFY-006",
    "email optout retains inbox and Base development captures contain only disclosed fields",
    async () => {
      const preferences = peer.getByRole("region", {
        name: "Notifications",
        exact: true,
      });
      assert.equal(
        await preferences
          .getByLabel("Email assignments and mentions", { exact: true })
          .isEnabled(),
        true,
        "configured email preference remains enabled",
      );
      assert.equal(
        await preferences
          .getByText(/Email notifications are off for this installation/)
          .count(),
        0,
        "configured email does not show unavailable guidance",
      );
      await receipt(peer, "/api/settings/notifications", "PATCH", () =>
        preferences
          .getByLabel("Email assignments and mentions", { exact: true })
          .click(),
      );
      await poll(
        () =>
          preferences
            .getByLabel("Email assignments and mentions", { exact: true })
            .isChecked(),
        (checked) => !checked,
        "email optout control unchecked",
      );
      await peerCapture("settings-email-optout");
      const before = counts(runtime, issue, operator);
      await comment("Email opted out private comment ", true);
      await poll(
        () => counts(runtime, issue, operator),
        (r) => r.inbox === before.inbox + 1,
        "optout inbox",
      );
      assert.equal(counts(runtime, issue, operator).mail, before.mail);
      assert.equal(
        runtime.sql("SELECT count(*) n FROM notification_deliveries")[0].n,
        4,
        "optout creates no mail intent",
      );
      const captures = runtime.sql(
        "SELECT * FROM (SELECT json_extract(message,'$.deliveryId') AS delivery_id,json_extract(message,'$.to[0]') AS recipient,json_extract(message,'$.subject') AS subject,json_extract(message,'$.text') AS text,created_at FROM rer_mail_development_outbox WHERE json_extract(message,'$.text') LIKE '%'||char(10)||'Sign in to view this issue.')",
      );
      assert.equal(captures.length, 4);
      for (const mail of captures) {
        assert.equal(mail.recipient, operator.email);
        assert.equal(mail.subject, `${issue.identifier}: ${issue.title}`);
        assert.equal(
          mail.text,
          `${issue.identifier}: ${issue.title}\nBy: ${owner.name}\n\n${runtime.base}/app/issues/${issue.identifier}\nSign in to view this issue.`,
        );
        assert.doesNotMatch(
          JSON.stringify(mail),
          /PRIVATE_DESCRIPTION_SENTINEL|PRIVATE_COMMENT_SENTINEL/,
        );
      }
      await navigate(peer, runtime.base + "/app/inbox");
      await peerCapture("inbox-email-optout-retained");
    },
  );
}
