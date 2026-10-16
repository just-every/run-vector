import "./settings.css";
import { IntegrationsPanel } from "../../integrations/ui/integrations-panel";
import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { z } from "zod";
import { ApiError, fetchJson, useApiResource } from "../../../app/api-client";
import { settingsSchema } from "../schema";
import { administrationSchema } from "../../administration/schema";
import { TeamsPanel } from "./teams-panel";
import { LabelsPanel } from "./labels-panel";
import { CyclesPanel } from "../../cycles/ui/cycles-panel";
import { NotificationsPanel } from "../../notifications/ui/notifications-panel";
import { DataPanel } from "../../data/ui/data-panel";
import { InviteOperator } from "./invite-operator";
import { RestorePanel } from "../../data/ui/restore-panel";

export function SettingsPage() {
  const administration = useApiResource(
    "/api/settings/administration",
    administrationSchema,
  );
  const resource = useApiResource("/api/settings", settingsSchema, 5000);
  const [reminderTime, setReminderTime] = useState<string | null>(null);
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
          reminderTime: reminderTime ?? resource.data.workspace.reminderTime,
        }),
      });
      setTimezone(updated.workspace.timezone);
      setReminderTime(updated.workspace.reminderTime);
      setMessage("Workspace time saved.");
      resource.reload();
      administration.reload();
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
      administration.reload();
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
        <p>Manage workspace time, operators and work organisation.</p>
      </header>
      {resource.data && administration.data && (
        <nav className="settings-sections" aria-label="Settings sections">
          <a href="#workspace-time">Workspace time</a>
          <a href="#operators">Operators</a>
          <a href="#teams">Teams</a>
          <a href="#labels">Labels</a>
          <a href="#projects">Projects</a>
          <a href="#cycles">Cycles</a>
          <a href="#integrations">Integrations</a>
          <a href="#notifications">Notifications</a>
          <a href="#data">Data / Move in</a>
          <a href="#after-restore">After a restore</a>
        </nav>
      )}
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
          <section id="workspace-time" aria-labelledby="timezone-heading">
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
                Timezone, for example Australia/Brisbane or Europe/London.
              </p>
              <label htmlFor="workspace-reminder-time">
                Daily due reminder time
              </label>
              <input
                id="workspace-reminder-time"
                type="time"
                required
                value={reminderTime ?? resource.data.workspace.reminderTime}
                disabled={pending}
                onChange={(event) => setReminderTime(event.target.value)}
                aria-describedby="reminder-time-help"
              />
              <p id="reminder-time-help">
                Inbox reminders for assigned work use this workspace time.
                Overdue work is reminded once when the next day begins.
              </p>
              <button disabled={pending || denied} type="submit">
                Save workspace time
              </button>
            </form>
          </section>
          <section id="operators" aria-labelledby="operators-heading">
            <h2 id="operators-heading">Operators</h2>
            <p>
              All operators have equal access and can remove other operators. Only the setup operator can remove their own setup account; the last operator must remain.
            </p>
            {!resource.data.workspace.setupOperatorId && (
              <p role="alert">
                Ask the person who deployed Vector to finish owner setup before
                removing operators. They can run the setup command in DEPLOY.md
                and set the first owner’s email (FIRST_OWNER_EMAIL).
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
                <button
                  autoFocus
                  disabled={pending}
                  type="button"
                  onClick={remove}
                >
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
            <InviteOperator
              delivery={resource.data.invitationDelivery}
              disabled={pending || denied}
              onInvited={() => {
                resource.reload();
                administration.reload();
              }}
            />
          </section>
          {administration.loading && (
            <p role="status">Loading workspace administration…</p>
          )}
          {administration.error && (
            <p role="alert">
              {administration.error.message}{" "}
              <button type="button" onClick={administration.reload}>
                Retry administration
              </button>
            </p>
          )}
          {administration.data && (
            <>
              <TeamsPanel
                teams={administration.data.teams}
                onChanged={administration.reload}
              />
              <LabelsPanel
                labels={administration.data.labels}
                onChanged={administration.reload}
              />
              <section
                id="projects"
                aria-labelledby="settings-projects-heading"
              >
                <h2 id="settings-projects-heading">Projects</h2>
                <p>
                  Create projects and manage their lead, lifecycle and archive
                  status from Projects.
                </p>
                <Link className="admin-link" to="/app/projects">
                  Open Projects
                </Link>
              </section>
              <CyclesPanel
                data={administration.data}
                onChanged={administration.reload}
              />
            </>
          )}
          <DataPanel />
          <RestorePanel />
          <div id="notifications">
            <IntegrationsPanel teams={administration.data?.teams ?? []} />
            <NotificationsPanel />
          </div>
        </>
      )}
    </main>
  );
}
