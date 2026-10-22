import { useState } from "react";
import { fetchJson } from "../../../app/api-client";
import {
  slackLookup,
  type SlackDirectPreferences,
  type SlackLookup,
} from "../../integrations/slack-dm/schema";
import type { NotificationSettings } from "../schema";
import { preferencesSchema } from "./data";

/** SLACK-004: the member links their own Slack account, confirms it, and chooses which events reach Slack. */
export function SlackDirectMessages({
  slack,
  onSaved,
}: {
  slack: SlackDirectPreferences;
  onSaved: (value: NotificationSettings) => void;
}) {
  const [found, setFound] = useState<SlackLookup["match"]>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setNotice("");
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Slack linking could not complete.");
    } finally {
      setPending(false);
    }
  }
  const lookup = () =>
    run(async () => {
      const result = await fetchJson("/api/settings/notifications/slack/lookup", slackLookup, { method: "POST" });
      setFound(result.match);
      if (!result.match) setNotice(result.message ?? "No Slack account found for this email");
    });
  const confirm = (slackUserId: string) =>
    run(async () => {
      onSaved(
        await fetchJson("/api/settings/notifications/slack/link", preferencesSchema, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slackUserId }),
        }),
      );
      setFound(null);
      setNotice("Slack account linked. Choose which notifications reach Slack.");
    });
  const unlink = () =>
    run(async () => {
      onSaved(await fetchJson("/api/settings/notifications/slack/link", preferencesSchema, { method: "DELETE" }));
      setNotice("Slack account unlinked. Slack direct messages have stopped.");
    });
  const link = slack.link;
  return (
    <div className="slack-direct-messages" role="group" aria-labelledby="slack-direct-heading">
      <h3 id="slack-direct-heading">Slack direct messages</h3>
      {!slack.available ? (
        <p>Slack direct messages are unavailable. {slack.reason}</p>
      ) : link ? (
        <div className="slack-direct-link">
          <p>
            Linked to Slack as <strong>{link.name}</strong> in {link.teamName} since {link.linkedAt.slice(0, 10)}.
          </p>
          <button type="button" disabled={pending} onClick={() => void unlink()}>
            Unlink Slack
          </button>
        </div>
      ) : found ? (
        <div className="slack-direct-link" role="group" aria-label="Confirm your Slack account">
          <p>
            Slack found <strong>{found.name}</strong>
            {found.realName && found.realName !== found.name ? ` (${found.realName})` : ""} in {found.teamName} for{" "}
            {slack.email}. Link this account?
          </p>
          <button type="button" disabled={pending} onClick={() => void confirm(found.slackUserId)}>
            Confirm Slack link
          </button>
          <button type="button" disabled={pending} onClick={() => setFound(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="slack-direct-link">
          <p>
            Vector looks up the Slack account for your sign-in email, {slack.email}, and links it only after you
            confirm. You can unlink at any time.
          </p>
          <button type="button" disabled={pending} onClick={() => void lookup()}>
            Link Slack
          </button>
        </div>
      )}
      {pending && <p role="status">Checking Slack…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {slack.available && !link && <p>Link your Slack account to turn on Slack direct messages.</p>}
      {slack.available &&
        (slack.actionsEnabled ? (
          <p>
            Each message offers Open, Assign to me and Change status. Actions run as you and refuse an issue that
            changed after the message was sent.
          </p>
        ) : (
          <p>
            Assign to me and Change status are off until an Admin enters the Slack signing secret in Settings →
            Integrations. Direct messages offer Open only.
          </p>
        ))}
      <p>
        A direct message carries the event, issue identifier and title, who acted, any due date and a sign-in link.
        It never includes descriptions, comments or attachments.
      </p>
      <h4>Slack delivery updates</h4>
      {slack.deliveries.length === 0 ? (
        <p>No failed or uncertain Slack direct messages.</p>
      ) : (
        <ul>
          {slack.deliveries.map((delivery) => (
            <li key={delivery.id}>
              <div>
                <strong>
                  {delivery.identifier} · {delivery.title}
                </strong>
                <span>{delivery.reason}</span>
                <span>
                  {delivery.attempts} {delivery.attempts === 1 ? "attempt" : "attempts"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
