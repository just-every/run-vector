import { useState, type FormEvent } from "react";
import { fetchJson } from "../../../app/api-client";
import { useHydrated } from "../../../app/initial-resources";
import { SafeMarkdown } from "../../markdown/ui/markdown";
import { projectDetailSchema, type ProjectDetailData } from "./data";
import { shortProjectDate } from "./helpers";
import "./project-milestones.css";

type Milestone = ProjectDetailData["milestones"][number];

export function ProjectMilestones({ project, onChanged }: {
  project: ProjectDetailData;
  onChanged: (project: ProjectDetailData) => void;
}) {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const base = `/api/settings/projects/${project.id}/milestones`;
  async function run(path: string, method: string, body?: unknown) {
    if (pending) return false;
    setPending(true); setError("");
    try {
      const receipt = await fetchJson(base + path, projectDetailSchema, {
        method, headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      onChanged(receipt);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The milestone could not be saved.");
      return false;
    } finally { setPending(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>, milestone?: Milestone) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (await run(milestone ? `/${milestone.id}` : "", milestone ? "PATCH" : "POST", {
      name: data.get("name"), description: data.get("description"), targetDate: data.get("targetDate") || null,
    })) { setEditing(null); setCreating(false); }
  }
  async function move(index: number, direction: number) {
    const ids = project.milestones.map(item => item.id);
    [ids[index], ids[index + direction]] = [ids[index + direction]!, ids[index]!];
    await run("/order", "PUT", {milestoneIds:ids});
  }
  const disabled = pending || !hydrated;
  return <section className="project-milestones" aria-label="Project milestones">
    <header><div><h2>Milestones</h2><p>Follow the steps from first delivery to completion.</p></div>
      <button type="button" disabled={disabled || creating} onClick={() => setCreating(true)}>Add milestone</button>
    </header>
    {error && <p role="alert">{error}</p>}
    {creating && <MilestoneForm disabled={disabled} onSave={save} onCancel={() => setCreating(false)} />}
    {project.milestones.length === 0 && !creating && <p>No milestones yet.</p>}
    <ol>{project.milestones.map((milestone, index) => <li key={milestone.id} aria-label={`Milestone ${milestone.name}`}>
      {editing === milestone.id ? <MilestoneForm milestone={milestone} disabled={disabled}
        onSave={event => save(event, milestone)} onCancel={() => setEditing(null)} /> : <>
        <div className="project-milestones__heading"><h3>{milestone.name}</h3>
          <span className={milestone.slipped ? "project-milestones__slipped" : ""}>
            {milestone.slipped ? "Slipped" : milestone.completed ? "Completed" : "Open"}
          </span>
          {milestone.completed && milestone.slipped && <span>Completed milestone</span>}
        </div>
        {milestone.description && <SafeMarkdown>{milestone.description}</SafeMarkdown>}
        <p className="project-milestones__facts">{milestone.targetDate ? `Target ${shortProjectDate(milestone.targetDate)}` : "No target date"}
          <span>{milestone.progress.total === 0 ? "No countable issues" : `${milestone.progress.completed}/${milestone.progress.total} issues complete · ${milestone.progress.percentage}%`}</span>
        </p>
        {milestone.progress.percentage !== null && <progress aria-label={`${milestone.name} progress`} value={milestone.progress.completed} max={milestone.progress.total} />}
        <div className="project-milestones__actions">
          <button type="button" disabled={disabled} onClick={() => setEditing(milestone.id)}>Edit {milestone.name}</button>
          <button type="button" disabled={disabled} onClick={() => void run(`/${milestone.id}`, "PATCH", {completed:!milestone.completed})}>{milestone.completed ? "Reopen" : "Complete"} {milestone.name}</button>
          <button type="button" aria-label={`Move ${milestone.name} up`} disabled={disabled || index === 0} onClick={() => void move(index, -1)}>↑</button>
          <button type="button" aria-label={`Move ${milestone.name} down`} disabled={disabled || index === project.milestones.length - 1} onClick={() => void move(index, 1)}>↓</button>
          <button type="button" disabled={disabled} onClick={() => setDeleting(milestone.id)}>Delete {milestone.name}</button>
        </div>
        {deleting === milestone.id && <div className="project-milestones__delete" role="group" aria-label={`Delete ${milestone.name}`}>
          <p>Delete this milestone? Its issues stay in the project and lose their milestone.</p>
          <button type="button" disabled={disabled} onClick={() => void run(`/${milestone.id}`, "DELETE").then(saved => {if(saved) setDeleting(null);})}>Confirm delete {milestone.name}</button>
          <button type="button" disabled={disabled} onClick={() => setDeleting(null)}>Cancel deletion</button>
        </div>}
      </>}
    </li>)}</ol>
  </section>;
}

function MilestoneForm({milestone, disabled, onSave, onCancel}: {
  milestone?:Milestone; disabled:boolean; onSave:(event:FormEvent<HTMLFormElement>) => Promise<void>; onCancel:()=>void;
}) {
  return <form aria-label={milestone ? `Edit milestone ${milestone.name}` : "Create milestone"} onSubmit={onSave}>
    <fieldset disabled={disabled}>
      <label>Milestone name<input name="name" required maxLength={120} defaultValue={milestone?.name} /></label>
      <label>Milestone target date<input name="targetDate" type="date" defaultValue={milestone?.targetDate ?? ""} /></label>
      <label className="project-milestones__description">Milestone description<textarea name="description" rows={3} defaultValue={milestone?.description} /></label>
      <div className="project-milestones__actions"><button>{milestone ? "Save milestone" : "Create milestone"}</button><button type="button" onClick={onCancel}>Cancel</button></div>
    </fieldset>
  </form>;
}
