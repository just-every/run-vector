import { useViewerTime } from '../../../app/viewer-time';
import { PersonalTimePanel } from './personal-time-panel';
import { AppearancePanel } from './appearance-panel';
import "./settings.css";
import { IntegrationsPanel } from "../../integrations/ui/integrations-panel";
import { SettingsSaveForm } from "./settings-save-form";
import { TimezonePicker } from "./timezone-picker";
import { Link } from "@tanstack/react-router";
import { ApiError, useApiResource } from "../../../app/api-client";
import { settingsSchema } from "../schema";
import { administrationSchema } from "../../administration/schema";
import { TeamsPanel } from "./teams-panel";
import { HousekeepingPanel } from "../../housekeeping/panel";
import { LabelsPanel } from "./labels-panel";
import { CyclesPanel } from "../../cycles/ui/cycles-panel";
import { NotificationsPanel } from "../../notifications/ui/notifications-panel";
import { DataPanel } from "../../data/ui/data-panel";
import { RestorePanel } from "../../data/ui/restore-panel";
import { MembersPanel } from "./members-panel";
import { openSettingsPages, opensSettingsPage } from "../../roles/matrix";

export function SettingsPage() {
  const clock = useViewerTime();
  const administration = useApiResource(
    "/api/settings/administration",
    administrationSchema,
  );
  const resource = useApiResource("/api/settings", settingsSchema, 5000);
  // A Guest opens Account only; the member directory answers 403 (ROLE-008 row "Open Settings pages").
  const accountOnly = resource.error instanceof ApiError && resource.error.status === 403;
  const denied =
    resource.error instanceof ApiError &&
    [401, 403].includes(resource.error.status);
  // Owners and Admins open every Settings page; a Member opens Account, the
  // member directory and their personal integrations and tokens.
  const workspace = resource.data ? openSettingsPages[resource.data.role] === "all" : false;
  return (
    <main className="settings-page">
      <header>
        <p className="settings-eyebrow">Workspace</p>
        <h1>Settings</h1>
        <p>Manage your account, workspace members and work organisation.</p>
      </header>
      {resource.data && administration.data && (
        <nav className="settings-sections" aria-label="Settings sections">
          <a href="#appearance">Appearance</a>
          <a href="#personal-time">Your time</a>
          {workspace && <a href="#workspace-time">Workspace time</a>}
          <a href="#members">Members</a>
          {resource.data && opensSettingsPage(resource.data.role,'teams') && <a href="#teams">Teams</a>}
          <a href="#labels">Labels</a>
          {workspace && <>
            <a href="#housekeeping">Auto-close</a>
            <a href="#projects">Projects</a>
            <a href="#cycles">Cycles</a>
          </>}
          {resource.data && opensSettingsPage(resource.data.role,'personal-integrations') && <a href="#integrations">Integrations</a>}
          <a href="#notifications">Notifications</a>
          {workspace && <a href="/app/settings/audit">Audit log</a>}
          {workspace && <a href="#data">Data / Move in</a>}
          {resource.data.role === "owner" && <a href="#after-restore">After a restore</a>}
        </nav>
      )}
      {resource.loading && <p role="status">Loading settings…</p>}
      {resource.error && !accountOnly && (
        <p role="alert">
          Settings couldn’t be loaded.{" "}
          {denied ? (
            <Link to="/signin">Sign in again</Link>
          ) : (
            <button type="button" onClick={resource.reload}>
              Retry
            </button>
          )}
        </p>
      )}
      {accountOnly && (
        <>
          <AppearancePanel />
          <PersonalTimePanel />
          <NotificationsPanel />
        </>
      )}
      {resource.data && (
        <>
          <AppearancePanel />
          <PersonalTimePanel />
          {workspace && <section id="workspace-time" aria-labelledby="timezone-heading">
            <h2 id="timezone-heading">Workspace time</h2>
            <p>
              Workspace calendar days and cycle boundaries use this timezone. Existing
              timestamps are retained.
            </p>
            <SettingsSaveForm path="/api/settings" method="PATCH" schema={settingsSchema} aria-label="Workspace time"
              read={fields => ({timezone:fields.get('timezone'), reminderTime:fields.get('reminderTime')})}
              onSaved={updated => {
                clock.publish({...updated.personalTime, workspaceTimezone:updated.workspace.timezone, reminderTime:updated.workspace.reminderTime,workspaceTimezoneDefault:false});
                resource.reload(); administration.reload();
              }}>
              <TimezonePicker id="workspace-timezone" label="Workspace timezone" value={resource.data.workspace.timezone} />
              <label htmlFor="workspace-reminder-time">
                Daily due reminder time
              </label>
              <input
                id="workspace-reminder-time"
                type="time"
                required
                name="reminderTime"
                defaultValue={resource.data.workspace.reminderTime}
                aria-describedby="reminder-time-help"
              />
              <p id="reminder-time-help">
                Inbox reminders for assigned work use this time in each assignee’s timezone.
                Overdue work is reminded once when the next day begins.
              </p>
            </SettingsSaveForm>
          </section>}
          <MembersPanel
            data={resource.data}
            denied={denied}
            onChanged={() => {
              resource.reload();
              administration.reload();
            }}
          />
          {administration.loading && (
            <p role="status">Loading workspace administration…</p>
          )}
          {administration.error && (
            <p role="alert">
              Workspace administration couldn’t be loaded.{" "}
              <button type="button" onClick={administration.reload}>
                Retry administration
              </button>
            </p>
          )}
          {administration.data && opensSettingsPage(resource.data.role,'teams') && (
            <TeamsPanel
              data={administration.data}
              onChanged={administration.reload}
            />
          )}
          {administration.data && (
            <LabelsPanel
              labels={administration.data.labels}
              onChanged={administration.reload}
              readOnly={!workspace}
              memberLabelCreation={administration.data.workspace.memberLabelCreation}
            />
          )}
          {workspace && administration.data && (
            <>
              <HousekeepingPanel
                data={administration.data}
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
          {workspace && <DataPanel />}
          {/* Restore review has no role-matrix row, so it is the Owners' (ROLE-008). */}
          {resource.data.role === "owner" && <RestorePanel />}
          <div id="notifications">
            {opensSettingsPage(resource.data.role,'personal-integrations') && <IntegrationsPanel teams={administration.data?.teams ?? []} workspace={workspace} />}
            <NotificationsPanel />
          </div>
        </>
      )}
    </main>
  );
}
