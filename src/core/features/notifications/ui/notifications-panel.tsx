import { useEffect, useState } from "react";
import { fetchJson, useApiResource } from "../../../app/api-client";
import {
  notificationKinds,
  type NotificationKind,
  type NotificationSettings,
} from "../schema";
import { preferencesSchema, subscriptionSchema } from "./data";
import { SlackDirectMessages } from "./slack-direct-messages";
import { NotificationChannels } from "./notification-channels";
import { channelLabels } from "./channel-data";
import "./notifications.css";

export function EmailUnavailableNotice() {
  return (
    <>
      <p>
        Email notifications are off for this installation. Notification mail
        needs a configured provider and must be enabled.
      </p>
      <p>
        Ask whoever deployed Vector to enable email notifications. See the{" "}
        <a
          href="https://github.com/just-every/run-vector/blob/main/DEPLOY.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          deployment guide
        </a>{" "}
        for setup steps.
      </p>
    </>
  );
}

export function NotificationsPanel() {
  const resource = useApiResource(
    "/api/settings/notifications",
    preferencesSchema,
  );
  const [data, setData] = useState<NotificationSettings | null>(null);
  useEffect(() => {
    setData(resource.data);
  }, [resource.data]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(
    patch: { emailEnabled?: boolean; mutedKinds?: NotificationKind[] },
    identifier?: string,
  ) {
    if (pending) return;
    setPending(true);
    setMessage("");
    setError("");
    try {
      if (identifier) {
        await fetchJson(
          `/api/issues/${encodeURIComponent(identifier)}/subscription`,
          subscriptionSchema,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ muted: false }),
          },
        );
        setData((current) =>
          current
            ? {
                ...current,
                mutedIssues: current.mutedIssues.filter(
                  (issue) => issue.identifier !== identifier,
                ),
              }
            : null,
        );
      } else
        setData(
          await fetchJson("/api/settings/notifications", preferencesSchema, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
          }),
        );
      resource.reload();
      setMessage("Notification preferences saved.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save notification preferences.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="notifications-panel"
      aria-labelledby="notifications-heading"
    >
      <h2 id="notifications-heading">Notifications</h2>
      <p>
        These preferences apply only to you and future notifications. Muting
        keeps your following and activity history.
      </p>
      {resource.loading && (
        <p role="status">Loading notification preferences…</p>
      )}
      {resource.error && (
        <p role="alert">
          {resource.error.message}{" "}
          {data && "Showing the last loaded preferences."}{" "}
          <button type="button" onClick={resource.reload}>
            Retry notifications
          </button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {resource.data && data && <NotificationChannels settings={data} />}
      {resource.data && data && (
        <fieldset disabled={pending || resource.loading}>
          <legend>Your notification preferences</legend>
          <label className="notification-checkbox">
            <input
              type="checkbox"
              checked={data.emailAvailable && data.emailEnabled}
              disabled={!data.emailAvailable}
              onChange={(event) =>
                void save({ emailEnabled: event.target.checked })
              }
            />
            Allow email notifications
          </label>
          <p>Pausing email stops immediate notifications and digests. Your event channel choices are kept.</p>
          {!data.emailAvailable && <EmailUnavailableNotice />}
          <SlackDirectMessages
            slack={data.slack}
            onSaved={(value) => {
              setData(value);
              resource.reload();
            }}
          />
          <p>Mute event types in your inbox, email and Slack direct messages:</p>
          <div className="notification-mutes">
            {notificationKinds.map((kind) => (
              <label className="notification-checkbox" key={kind}>
                <input
                  type="checkbox"
                  checked={data.mutedKinds.includes(kind)}
                  onChange={(event) =>
                    void save({
                      mutedKinds: event.target.checked
                        ? [...data.mutedKinds, kind]
                        : data.mutedKinds.filter((value) => value !== kind),
                    })
                  }
                />
                {channelLabels[kind]}
              </label>
            ))}
          </div>
          <h3>Muted issues</h3>
          {data.mutedIssues.length === 0 ? (
            <p>No muted issues.</p>
          ) : (
            <ul>
              {data.mutedIssues.map((issue) => (
                <li key={issue.identifier}>
                  <div>
                    <strong>{issue.identifier}</strong>
                    <span>{issue.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void save({}, issue.identifier)}
                  >
                    Unmute {issue.identifier}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <h3>Email delivery updates</h3>
          {data.deliveries.length === 0 ? (
            <p>No failed or uncertain deliveries.</p>
          ) : (
            <ul>
              {data.deliveries.map((delivery) => (
                <li key={delivery.id}>
                  <div>
                    <strong>
                      {delivery.identifier} · {delivery.title}
                    </strong>
                    <span>
                      {delivery.status === "uncertain"
                        ? "Delivery uncertain. It will not be sent again automatically."
                        : "Email delivery failed."}
                    </span>
                    <span>
                      {delivery.attempts}{" "}
                      {delivery.attempts === 1 ? "attempt" : "attempts"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pending && <p role="status">Saving…</p>}
        </fieldset>
      )}
    </section>
  );
}
