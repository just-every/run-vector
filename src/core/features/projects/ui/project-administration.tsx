import { ProjectAppearanceFields } from "./project-appearance";
import { useHydrated } from "../../../app/initial-resources";
import { useState } from "react";
import type { FormEvent } from "react";
import type { Administration } from "../../administration/schema";
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
export function ProjectCreate({
  operators,
  labels,
  onChanged,
  onCancel,
}: Props & { onCancel: () => void }) {
  const action = useAdministrationAction(onChanged);
  const hydrated = useHydrated();
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await action.run("/api/settings/projects", "POST", {...fields(form),createSlackChannel:new FormData(form).has("createSlackChannel")}))
      form.reset();
  }
  return (
    <form aria-label="Create project" onSubmit={create}>
      <fieldset disabled={action.pending || !hydrated}>
        <ProjectFields operators={operators} labels={labels} autoFocus />
        <label className="admin-checkbox"><input name="createSlackChannel" type="checkbox"/>Create Slack channel</label>
        <p>Creates a public channel from the project name and binds new issue, triage and status events. Connect Slack in Settings → Integrations first. A Slack error stops creation.</p>
        <div className="admin-actions">
          <button>Create project</button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
      <AdministrationFeedback action={action} />
    </form>
  );
}
export function ProjectAdministration({
  project,
  operators,
  labels,
  onChanged,
  onDeleted,
}: Props & { project: Administration["projects"][number]; onDeleted: () => void }) {
  const action = useAdministrationAction(onChanged);
  const deletion = useAdministrationAction(onDeleted);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hydrated = useHydrated();
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
      {confirmingDelete ? (
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
        <button type="button" disabled={action.pending || !hydrated} onClick={() => setConfirmingDelete(true)}>Delete project</button>
      )}
    </details>
  );
}
function ProjectFields({
  operators,
  labels,
  project,
  autoFocus = false,
}: {
  autoFocus?: boolean;
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
          defaultValue={project?.leadOperatorId ?? ""}
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
      <label>
        Project labels
        <select name="labelIds" aria-label="Project labels" multiple defaultValue={project?.labelIds ?? []}>
          {labels.filter(label=>label.projectsEnabled).map(label=><option key={label.id} value={label.id}>{label.name}</option>)}
        </select>
        <small>Choose any labels marked for projects in Settings. Use Command or Ctrl to select several.</small>
      </label>
    </>
  );
}
