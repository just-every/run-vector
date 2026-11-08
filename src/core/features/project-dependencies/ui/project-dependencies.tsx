import { Link } from "@tanstack/react-router";
import { useId, useRef, useState, type FormEvent } from "react";
import { fetchJson } from "../../../app/api-client";
import { useHydrated } from "../../../app/initial-resources";
import { Tooltip } from "../../../ui/tooltip";
import { projectDetailSchema, type ProjectDetailData } from "../../projects/ui/data";
import { dependencyFailure, dependencyReceipt, relationLabel, type Direction } from "./text";
import "./project-dependencies.css";

type Project = { id: string; name: string };
type Edge = { id: string; direction: Direction; project: Project };

/** Direct project edges from this page's perspective. Writes use the same
 * native door as `/api/v1`; the response belongs to the blocked project. */
export function ProjectDependencies({ project, candidates, writable, onChanged }: {
  project: ProjectDetailData;
  candidates: Project[];
  writable: boolean;
  onChanged: (receipt: ProjectDetailData) => void;
}) {
  const headingId = useId(), relationId = useId(), projectId = useId();
  const hydrated = useHydrated();
  const summary = useRef<HTMLElement>(null);
  const [adding, setAdding] = useState(false);
  const [direction, setDirection] = useState<Direction>("blocked-by");
  const [target, setTarget] = useState("");
  const [pending, setPending] = useState<"add" | "remove" | null>(null);
  const [failure, setFailure] = useState("");
  const [receipt, setReceipt] = useState("");
  const edges: Edge[] = [
    ...project.directDependencies.blockedBy.map(edge => ({ ...edge, direction: "blocked-by" as const })),
    ...project.directDependencies.blocking.map(edge => ({ ...edge, direction: "blocking" as const })),
  ];
  const linked = new Set(edges.filter(edge => edge.direction === direction).map(edge => edge.project.id));
  const options = candidates.filter(candidate => candidate.id !== project.id && !linked.has(candidate.id));
  const busy = pending !== null || !hydrated;

  async function change(method: "PUT" | "DELETE", relation: Direction, other: Project) {
    if (pending) return false;
    setPending(method === "PUT" ? "add" : "remove");
    setFailure("");
    setReceipt("");
    const [blocked, blocking] = relation === "blocked-by" ? [project.id, other.id] : [other.id, project.id];
    try {
      const result = await fetchJson(`/api/projects/${blocked}/dependencies/${blocking}`, projectDetailSchema, { method });
      setReceipt(dependencyReceipt(method === "PUT", relation, project.name, other.name));
      onChanged(result);
      return true;
    } catch (cause) {
      setFailure(dependencyFailure(cause));
      return false;
    } finally {
      setPending(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const other = options.find(candidate => candidate.id === target);
    if (!other || !(await change("PUT", direction, other))) return;
    setAdding(false);
    setTarget("");
    summary.current?.focus();
  }

  async function remove(edge: Edge) {
    if (await change("DELETE", edge.direction, edge.project)) summary.current?.focus();
  }

  return (
    <section className="project-detail__section project-dependencies" aria-labelledby={headingId}>
      <h2 id={headingId}>Project dependencies</h2>
      {edges.length === 0 ? <p className="projects-empty">No project dependencies.</p> : (
        <ul className="project-dependencies__list">
          {edges.map(edge => (
            <li key={edge.id}>
              <span className="project-dependencies__relation">{relationLabel(edge.direction)}</span>
              <Link to="/app/projects/$projectId" params={{ projectId: edge.project.id }}>{edge.project.name}</Link>
              {writable && (
                <Tooltip label="Remove dependency">
                  <button type="button" className="project-dependencies__remove" disabled={busy}
                    aria-label={`${edge.direction === "blocked-by" ? "Remove blocker" : "Remove blocked project"} ${edge.project.name}`}
                    onClick={() => void remove(edge)}>×</button>
                </Tooltip>
              )}
            </li>
          ))}
        </ul>
      )}
      {writable && (
        <details open={adding}>
          <summary ref={summary} aria-disabled={busy || undefined} onClick={event => {
            event.preventDefault();
            if (busy) return;
            setAdding(!adding);
            setFailure("");
          }}>Add dependency</summary>
          {adding && (
            <form aria-label="Add project dependency" onSubmit={event => void submit(event)}>
              <fieldset disabled={busy}>
                <div className="project-dependencies__field">
                  <label htmlFor={relationId}>Relationship</label>
                  <select id={relationId} value={direction} onChange={event => { setDirection(event.target.value as Direction); setTarget(""); }}>
                    <option value="blocked-by">Blocked by</option>
                    <option value="blocking">Blocking</option>
                  </select>
                </div>
                <div className="project-dependencies__field">
                  <label htmlFor={projectId}>Project</label>
                  <select id={projectId} required value={target} onChange={event => setTarget(event.target.value)}>
                    <option value="">Choose a project</option>
                    {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </div>
                <button type="submit">{pending === "add" ? "Adding…" : "Add dependency"}</button>
              </fieldset>
            </form>
          )}
        </details>
      )}
      {failure && <p role="alert">{failure}</p>}
      {receipt && <p role="status">{receipt}</p>}
    </section>
  );
}
