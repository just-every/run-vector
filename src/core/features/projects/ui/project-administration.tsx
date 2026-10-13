import type { FormEvent } from "react";
import type { Administration } from "../../administration/schema";
import { useAdministrationAction } from "../../settings/ui/administration-action";
import { AdministrationFeedback } from "../../settings/ui/administration-feedback";
import "../../settings/ui/settings.css";
type Props = { operators: Administration["operators"]; onChanged: () => void };
function fields(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    name: data.get("name"),
    description: data.get("description"),
    leadOperatorId: data.get("lead"),
    targetDate: data.get("targetDate") || null,
  };
}
export function ProjectCreate({
  operators,
  onChanged,
  onCancel,
}: Props & { onCancel: () => void }) {
  const action = useAdministrationAction(onChanged);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await action.run("/api/settings/projects", "POST", fields(form)))
      form.reset();
  }
  return (
    <form aria-label="Create project" onSubmit={create}>
      <fieldset disabled={action.pending}>
        <ProjectFields operators={operators} autoFocus />
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
  onChanged,
}: Props & { project: Administration["projects"][number] }) {
  const action = useAdministrationAction(onChanged);
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
        <fieldset disabled={action.pending}>
          <ProjectFields operators={operators} project={project} />
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
    </details>
  );
}
function ProjectFields({
  operators,
  project,
  autoFocus = false,
}: {
  autoFocus?: boolean;
  operators: Administration["operators"];
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
      <label>
        Project target date
        <input
          name="targetDate"
          type="date"
          defaultValue={project?.targetDate ?? ""}
        />
      </label>
    </>
  );
}
