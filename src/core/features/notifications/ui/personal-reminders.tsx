import { useViewerTime } from '../../../app/viewer-time';
import { useHydrated } from '../../../app/initial-resources';
import { useId, useState } from "react";

import { usePersonalReminders } from "./use-personal-reminders";
import "./notifications.css";
import "./follow-ups.css";

export function PersonalReminderControls({
  identifier,
}: {
  identifier: string;
}) {
  const { formatInstant: followUpTime, localValue: localDateTimeValue, futureInstant: futureLocalInstant, effectiveTimezone } = useViewerTime();
  const hydrated = useHydrated();
  const id = useId();
  const reminders = usePersonalReminders(identifier);
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [error, setError] = useState("");
  const next = reminders.reminders
    ? [...reminders.reminders].sort((a, b) =>
        a.remindAt.localeCompare(b.remindAt),
      )[0]
    : null;
  async function create() {
    setError("");
    try {
      const remindAt = futureLocalInstant(when);
      if (await reminders.create(remindAt)) setWhen("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Choose a future date and time.",
      );
    }
  }
  return (
    <section
      className="personal-reminders"
      aria-label="Your personal reminders"
    >
      <div className="personal-reminder-summary">
        <button
          type="button"
          disabled={!hydrated}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          Remind me
        </button>
        {reminders.loading && reminders.reminders === null && (
          <span role="status">Loading personal reminders…</span>
        )}
        {next ? (
          <span>
            Next personal reminder:{" "}
            <time dateTime={next.remindAt}>{followUpTime(next.remindAt)}</time>
          </span>
        ) : (
          reminders.reminders && <span>No pending personal reminders.</span>
        )}
      </div>
      {(error || reminders.error) && (
        <p role="alert">
          {error || reminders.error?.message}{" "}
          {reminders.error && (
            <button
              type="button"
              disabled={!!reminders.pending}
              onClick={reminders.retry}
            >
              Retry personal reminders
            </button>
          )}
        </p>
      )}
      {reminders.message && <p role="status">{reminders.message}</p>}
      {open && (
        <div className="personal-reminder-panel" id={id}>
          <p>
            A private Inbox reminder for you. Times use {effectiveTimezone}.
          </p>
          {reminders.reminders && (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void create();
                }}
              >
                <label>
                  Remind me at ({effectiveTimezone})
                  <input
                    type="datetime-local"
                    required
                    min={localDateTimeValue(new Date())}
                    value={when}
                    disabled={!!reminders.pending}
                    onChange={(event) => setWhen(event.target.value)}
                  />
                </label>
                <button type="submit" disabled={!!reminders.pending}>
                  {reminders.pending === "create"
                    ? "Setting reminder…"
                    : "Set personal reminder"}
                </button>
              </form>
              {reminders.reminders.length > 0 && (
                <ul
                  className="personal-reminder-list"
                  aria-label="Pending personal reminders"
                >
                  {reminders.reminders.map((reminder) => (
                    <li key={reminder.id}>
                      <time dateTime={reminder.remindAt}>
                        {followUpTime(reminder.remindAt)}
                      </time>
                      <button
                        type="button"
                        disabled={!!reminders.pending}
                        aria-label={`Cancel reminder for ${followUpTime(reminder.remindAt)}`}
                        onClick={() => {
                          setError("");
                          void reminders.cancel(reminder.id);
                        }}
                      >
                        {reminders.pending === reminder.id
                          ? "Canceling…"
                          : "Cancel reminder"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
