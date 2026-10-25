import { useNavigate } from "@tanstack/react-router";
import { fetchJson } from "../../../app/api-client";
import { administrationSchema } from "../../administration/schema";
import { CreateSlackChannel } from "./project-slack-choice";
import {SaveProjectTemplate} from '../../project-templates/controls';
import { ProjectAppearanceFields } from "./project-appearance";
import { useHydrated } from "../../../app/initial-resources";
import { useState } from "react";
import type { FormEvent } from "react";
import type { Administration } from "../../administration/schema";
import { decide } from "../../roles/policy";
import { useAdministrationAction } from "../../settings/ui/administration-action";
import { AdministrationFeedback } from "../../settings/ui/administration-feedback";
import "../../settings/ui/settings.css";
type Props = { operators: Administration["operators"]; labels: Administration["labels"]; onChanged: () => void };
function fields(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    name: data.get("name"),
    description: data.get("description"),
    leadOperatorId: data.get("lead"),
    color: data.get("color") || null,
    icon: data.get("icon") || null,
    startDate: data.get("startDate") || null,
    targetDate: data.get("targetDate") || null,
    priority: data.get("priority"),
    labelIds: data.getAll("labelIds"),
  };
}
/** `channel`: whether the viewer may have the Slack bot create a channel (SLACK-003). */
export function ProjectCreate({
  operators,
  labels,
  channel,
  onChanged,
  onCancel,
  viewerId,
  projectIds,
}: Props & { channel: boolean; viewerId: string; projectIds: string[]; onCancel: () => void }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const hydrated = useHydrated();
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (pending) return;
    setPending(true); setError("");
    try {
      const result = await fetchJson("/api/settings/projects", administrationSchema, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...fields(form), createSlackChannel: new FormData(form).has("createSlackChannel") }),
      });
      const created = result.projects.find(project => !projectIds.includes(project.id));
      if (!created) throw new Error("The project was saved. Open Projects to find it.");
      onChanged();
      await navigate({ to: "/app/projects/$projectId", params: { projectId: created.id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The project could not be created."); }
    finally { setPending(false); }
  }
  return (
    <form aria-label="Create project" onSubmit={create}>
      <fieldset disabled={pending || !hydrated}>
        <ProjectFields operators={operators} labels={labels} defaultLead={viewerId} autoFocus />
        {channel && <CreateSlackChannel />}
        <div className="admin-actions">
          <button>Create project</button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function ProjectAdministration({
  project,
  viewer,
  operators,
  labels,
  onChanged,
  onDeleted,
}: Props & { project: Administration["projects"][number]; viewer: Administration["viewer"]; onDeleted: () => void }) {
  const action = useAdministrationAction(onChanged);
  const deletion = useAdministrationAction(onDeleted);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hydrated = useHydrated();
  const deletes = decide({ role: viewer.role, memberInvites: false, teams: new Map() },
    { row: "projects.delete" }) === "allow";
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action.run(`/api/settings/projects/${project.id}`, "PATCH", {
      ...fields(event.currentTarget),
      lifecycle: new FormData(event.currentTarget).get("lifecycle"),
    });
  }
  return (
    <details>
      <summary>
        Manage {project.name}
        {project.archivedAt ? " · Archived" : ""}
      </summary>
      <form aria-label={`Edit project ${project.name}`} onSubmit={save}>
        <fieldset disabled={action.pending || !hydrated}>
          <ProjectFields key={project.id + project.color + project.icon + project.startDate + project.targetDate + project.priority + project.labelIds.join(",")} operators={operators} labels={labels} project={project} />
          <label>
            Project lifecycle
            <select name="lifecycle" defaultValue={project.lifecycle}>
              {["planned", "active", "completed", "canceled"].map((value) => (
                <option key={value} value={value}>
                  {value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <button>Save project</button>
          <button
            type="button"
            onClick={() =>
              void action.run(`/api/settings/projects/${project.id}`, "PATCH", {
                archived: !project.archivedAt,
              })
            }
          >
            {project.archivedAt ? "Unarchive project" : "Archive project"}
          </button>
        </fieldset>
      </form>
      <AdministrationFeedback action={action} />
      <SaveProjectTemplate project={project} />
      {confirmingDelete && deletes ? (
        <div role="group" aria-label="Confirm project deletion">
          <p>Delete {project.name}? Its issues will stay in Vector without a project. This cannot be undone.</p>
          <button type="button" disabled={deletion.pending || !hydrated}
            onClick={() => void deletion.run(`/api/settings/projects/${project.id}`, "DELETE")}>
            Delete project and keep issues
          </button>
          <button type="button" disabled={deletion.pending} onClick={() => setConfirmingDelete(false)}>Cancel deletion</button>
          <AdministrationFeedback action={deletion} />
        </div>
      ) : (
        <>
          {!deletes && <p>Only Owners and Admins can delete projects.</p>}
          <button type="button" disabled={action.pending || !hydrated || !deletes} onClick={() => setConfirmingDelete(true)}>Delete project</button>
        </>
      )}
    </details>
  );
}
function ProjectFields({
  operators,
  labels,
  project,
  autoFocus = false,
  defaultLead,
}: {
  autoFocus?: boolean;
  defaultLead?: string;
  operators: Administration["operators"];
  labels: Administration["labels"];
  project?: Administration["projects"][number];
}) {
  return (
    <>
      <label>
        Project name
        <input
          name="name"
          autoFocus={autoFocus}
          required
          maxLength={120}
          defaultValue={project?.name}
        />
      </label>
      <label>
        Project description
        <textarea
          name="description"
          maxLength={100000}
          rows={4}
          defaultValue={project?.description}
        />
      </label>
      <label>
        Project lead
        <select
          name="lead"
          required
          defaultValue={project?.leadOperatorId ?? defaultLead ?? ""}
        >
          <option value="">Choose one lead</option>
          {operators.map((operator) => (
            <option key={operator.id} value={operator.id}>
              {operator.name}
            </option>
          ))}
        </select>
      </label>
      <ProjectAppearanceFields project={project} />
      <label>
        Project start date
        <input name="startDate" type="date" defaultValue={project?.startDate ?? ""} />
      </label>
      <label>
        Project target date
        <input
          name="targetDate"
          type="date"
          defaultValue={project?.targetDate ?? ""}
        />
      </label>
      <label>
        Project priority
        <select name="priority" defaultValue={project?.priority ?? "none"}>
          {["urgent","high","medium","low","none"].map(priority => <option key={priority} value={priority}>{priority === "none" ? "No priority" : priority[0].toUpperCase()+priority.slice(1)}</option>)}
        </select>
      </label>
      <fieldset><legend>Project labels</legend>
        <div className="project-label-pick">{labels.filter(label => label.projectsEnabled).map(label =>
          <label className="admin-checkbox" key={label.id}><input type="checkbox" name="labelIds" value={label.id} defaultChecked={project?.labelIds.includes(label.id)} />{label.name}</label>
        )}</div>
      </fieldset>
    </>
  );
}
