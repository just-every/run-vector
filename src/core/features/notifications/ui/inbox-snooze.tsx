import { useHydrated } from '../../../app/initial-resources';
import { useId, useState } from "react";
import { futureLocalInstant, localDateTimeValue } from "./follow-up-time";

export type SnoozeChoice = { until: string } | { untilChange: true };

export function InboxSnoozeControls({
  identifier,
  disabled,
  onSnooze,
}: {
  identifier: string;
  disabled: boolean;
  onSnooze: (choice: SnoozeChoice) => Promise<boolean>;
}) {
  const hydrated = useHydrated();
  disabled = disabled || !hydrated;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [error, setError] = useState("");
  async function snooze(choice: SnoozeChoice) {
    setError("");
    if (await onSnooze(choice)) setOpen(false);
  }
  return (
    <div className="inbox-snooze">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Snooze notification for ${identifier}`}
        onClick={() => setOpen((value) => !value)}
      >
        Snooze
      </button>
      {open && (
        <div className="inbox-snooze-panel" id={id}>
          <p>Snooze this notification until:</p>
          <div className="follow-up-actions">
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                void snooze({
                  until: new Date(Date.now() + 3_600_000).toISOString(),
                })
              }
            >
              In 1 hour
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void snooze({ untilChange: true })}
            >
              Until issue changes
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              try {
                void snooze({ until: futureLocalInstant(when) });
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Choose a future date and time.",
                );
              }
            }}
          >
            <label>
              Custom date and time (your local time)
              <input
                type="datetime-local"
                required
                min={localDateTimeValue(new Date())}
                value={when}
                disabled={disabled}
                onChange={(event) => setWhen(event.target.value)}
              />
            </label>
            <button type="submit" disabled={disabled}>
              Snooze until then
            </button>
          </form>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
