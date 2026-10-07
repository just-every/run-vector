import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { z } from "zod";
import { ApiError, fetchJson, useApiResource } from "../../../app/api-client";
import { settingsSchema } from "../schema";
import "./settings.css";
import { InviteOperator } from "./invite-operator";

export function SettingsPage() {
  const resource = useApiResource("/api/settings", settingsSchema, 5000);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const denied =
    resource.error instanceof ApiError &&
    [401, 403].includes(resource.error.status);
  const fail = (error: unknown) => {
    setMessage(
      error instanceof Error ? error.message : "The change could not be saved.",
    );
    if (error instanceof ApiError && [401, 403, 404].includes(error.status))
      resource.reload();
  };
  const saveTimezone = async (event: FormEvent) => {
    event.preventDefault();
    if (!resource.data) return;
    setPending(true);
    setMessage("");
    try {
      const updated = await fetchJson("/api/settings", settingsSchema, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          timezone: timezone ?? resource.data.workspace.timezone,
        }),
      });
      setTimezone(updated.workspace.timezone);
      setMessage("Workspace timezone saved.");
      resource.reload();
    } catch (error) {
      fail(error);
    } finally {
      setPending(false);
    }
  };
  const remove = async () => {
    if (!removing) return;
    setPending(true);
    setMessage("");
    try {
      const result = await fetchJson(
        "/api/settings/operators/" + removing,
        z.object({ removed: z.boolean(), signedOut: z.boolean() }),
        { method: "DELETE" },
      );
      if (result.signedOut) {
        window.location.assign("/signin");
        return;
      }
      setRemoving(null);
      setMessage("Operator removed. Their sessions are revoked.");
      resource.reload();
    } catch (error) {
      fail(error);
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="settings-page">
      <header>
        <p className="settings-eyebrow">Workspace</p>
        <h1>Settings</h1>
        <p>Manage workspace time and operator access.</p>
      </header>
      {resource.loading && <p role="status">Loading settings…</p>}
      {resource.error && (
        <p role="alert">
          {resource.error.message}{" "}
          {denied ? (
            <Link to="/signin">Sign in again</Link>
          ) : (
            <button type="button" onClick={resource.reload}>
              Retry
            </button>
          )}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {resource.data && (
        <>
          <section aria-labelledby="timezone-heading">
            <h2 id="timezone-heading">Workspace time</h2>
            <p>
              Calendar days and work windows use this timezone. Existing
              timestamps are retained.
            </p>
            <form onSubmit={saveTimezone}>
              <label htmlFor="workspace-timezone">IANA timezone</label>
              <input
                id="workspace-timezone"
                required
                maxLength={100}
                value={timezone ?? resource.data.workspace.timezone}
                disabled={pending}
                onChange={(event) => setTimezone(event.target.value)}
                aria-describedby="timezone-help"
              />
              <p id="timezone-help">
                For example, Australia/Brisbane or Europe/London.
              </p>
              <button disabled={pending || denied} type="submit">
                Save timezone
              </button>
            </form>
          </section>
          <section aria-labelledby="operators-heading">
            <h2 id="operators-heading">Operators</h2>
            <p>
              All operators have equal access. The setup operator can only
              remove themselves; the last operator must remain.
            </p>
            {!resource.data.workspace.setupOperatorId && (
              <p role="alert">
                The installation owner must be configured before operators can
                be removed.
              </p>
            )}
            <ul>
              {resource.data.operators.map((operator) => {
                const own = operator.id === resource.data!.operatorId;
                const protectedOwner =
                  operator.id === resource.data!.workspace.setupOperatorId &&
                  !own;
                return (
                  <li key={operator.id}>
                    <div>
                      <strong>
                        {operator.name}
                        {own ? " (you)" : ""}
                      </strong>
                      <span>{operator.email}</span>
                    </div>
                    <button
                      type="button"
                      disabled={
                        pending ||
                        denied ||
                        resource.data!.operators.length === 1 ||
                        protectedOwner ||
                        !resource.data!.workspace.setupOperatorId
                      }
                      onClick={() => {
                        setRemoving(operator.id);
                        setMessage("");
                      }}
                    >
                      Remove {operator.name}
                    </button>
                  </li>
                );
              })}
            </ul>
            {removing && (
              <div
                className="settings-confirm"
                role="group"
                aria-label="Confirm operator removal"
              >
                <p>
                  Remove this operator? Their sessions will end, open issues
                  will be unassigned, and projects and shared views will
                  transfer. Retained history will show an anonymous operator.
                </p>
                <button disabled={pending} type="button" onClick={remove}>
                  Confirm removal
                </button>
                <button
                  disabled={pending}
                  type="button"
                  onClick={() => setRemoving(null)}
                >
                  Cancel
                </button>
              </div>
            )}
            <InviteOperator disabled={pending || denied} onInvited={resource.reload} />
          </section>
        </>
      )}
    </main>
  );
}
