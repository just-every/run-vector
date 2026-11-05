import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { fetchJson } from "../../../app/api-client";
import { useHydrated } from "../../../app/initial-resources";
import type { Administration } from "../../administration/schema";
import { projectDetailSchema, type ProjectDetailData } from "./data";
import "./project-dependencies.css";

type Direction = "blockedBy" | "blocking";

export function ProjectDependencies({ project, projects, writable, onChanged }: {
  project: ProjectDetailData;
  projects: Administration["projects"];
  writable: boolean;
  onChanged: (receipt: ProjectDetailData) => void;
}) {
  const hydrated = useHydrated();
  const [direction, setDirection] = useState<Direction>("blockedBy");
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const disabled = pending || !hydrated;
  const choices = projects.filter(candidate => candidate.id !== project.id &&
    !project.directDependencies[direction].some(edge => edge.project.id === candidate.id));

  async function change(otherId: string, relation: Direction, present: boolean) {
    if (pending) return;
    const blocked = relation === "blockedBy" ? project.id : otherId;
    const blocking = relation === "blockedBy" ? otherId : project.id;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const receipt = await fetchJson(`/api/projects/${blocked}/dependencies/${blocking}`, projectDetailSchema, {
        method: present ? "PUT" : "DELETE",
      });
      // The mutation returns the blocked endpoint. When editing its blocking
      // project, read that project's own projection after the commit.
      onChanged(blocked === project.id ? receipt : await fetchJson(`/api/projects/${project.id}`, projectDetailSchema));
      setSelected("");
      setMessage(present ? "Dependency added." : "Dependency removed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The dependency could not be saved.");
    } finally {
      setPending(false);
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (choices.some(candidate => candidate.id === selected)) void change(selected, direction, true);
  }

  return <section className="project-dependencies project-detail__section" aria-label="Project dependencies">
    <h2>Project dependencies</h2>
    <div className="project-dependencies__groups">
      {(["blockedBy", "blocking"] as const).map(relation => <div key={relation}>
        <h3>{relation === "blockedBy" ? "Blocked by" : "Blocking"}</h3>
        {project.directDependencies[relation].length === 0 ? <p>None recorded.</p> :
          <ul aria-label={relation === "blockedBy" ? "Blocking projects" : "Blocked projects"}>
            {project.directDependencies[relation].map(edge => <li key={edge.id}>
              <Link to="/app/projects/$projectId" params={{ projectId: edge.project.id }}>{edge.project.name}</Link>
              {writable && <button type="button" disabled={disabled}
                aria-label={`Remove ${relation === "blockedBy" ? "blocked by" : "blocking"} ${edge.project.name}`}
                onClick={() => void change(edge.project.id, relation, false)}>Remove</button>}
            </li>)}
          </ul>}
      </div>)}
    </div>
    {writable && <form aria-label="Add project dependency" onSubmit={add}>
      <fieldset disabled={disabled}>
        <label>Dependency direction
          <select value={direction} onChange={event => { setDirection(event.target.value as Direction); setSelected(""); }}>
            <option value="blockedBy">Blocked by</option>
            <option value="blocking">Blocking</option>
          </select>
        </label>
        <label>Dependency project
          <select required value={selected} onChange={event => setSelected(event.target.value)}>
            <option value="">Choose a project</option>
            {choices.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </select>
        </label>
        <button disabled={disabled || !choices.some(candidate => candidate.id === selected)}>Add dependency</button>
      </fieldset>
    </form>}
    {error && <p role="alert">{error}</p>}
    <p role="status">{pending ? "Saving dependency…" : message}</p>
  </section>;
}
