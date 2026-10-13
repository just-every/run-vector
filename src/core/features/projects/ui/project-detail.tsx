import { ProjectCycleHistory } from './cycle-history';
import { SafeMarkdown } from "../../markdown/ui/markdown";
import { administrationSchema } from "../../administration/schema";
import { ProjectAdministration } from "./project-administration";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useApiResource } from "../../../app/api-client";
import {
  activeHealthLabel,
  lifecycleLabel,
  projectProgressLabel,
  shortProjectDate,
} from "./helpers";
import { projectDetailSchema, type ProjectDetailData } from "./data";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const administration = useApiResource(
    "/api/settings/administration",
    administrationSchema,
  );
  const project = useApiResource(
    `/api/projects/${projectId}`,
    projectDetailSchema,
  );
  if (project.loading && project.data === null)
    return (
      <main className="projects-state" aria-live="polite">
        Loading project…
      </main>
    );
  if (project.error || project.data === null)
    return (
      <main className="projects-state projects-state--error" role="alert">
        <strong>Unable to load this project.</strong>
        <span>{project.error?.message}</span>
        <button type="button" onClick={project.reload}>
          Try again
        </button>
      </main>
    );
  const record = administration.data?.projects.find(
    (item) => item.id === projectId,
  );
  return (
    <ProjectDetailContent
      project={project.data}
      management={
        <section
          className="administration-panel project-management"
          aria-label="Project administration"
        >
          {administration.loading && (
            <p role="status">Loading project management…</p>
          )}
          {administration.error && (
            <p role="alert">
              {administration.error.message}{" "}
              <button type="button" onClick={administration.reload}>
                Retry administration
              </button>
            </p>
          )}
          {record && administration.data && (
            <ProjectAdministration
              project={record}
              operators={administration.data.operators}
              onChanged={() => {
                administration.reload();
                project.reload();
              }}
            />
          )}
        </section>
      }
    />
  );
}

function ProjectDetailContent({
  project,
  management,
}: {
  project: ProjectDetailData;
  management: ReactNode;
}) {
  const health = activeHealthLabel(project.health);
  return (
    <main className="project-detail" aria-labelledby="project-title">
      <header className="project-detail__header">
        <div>
          <Link className="detail-back" to="/app/projects">
            ← Projects
          </Link>
          <p className="stream-overline">
            {lifecycleLabel(project.lifecycle)} project
          </p>
          <h1 id="project-title">{project.name}</h1>
          <SafeMarkdown>
            {project.description || "No description has been recorded."}
          </SafeMarkdown>
        </div>
        <div className="project-detail__badges">
          <span className="project-lifecycle">
            {lifecycleLabel(project.lifecycle)}
          </span>
          {health ? (
            <span
              className={`project-health project-health--${project.health}`}
            >
              {health}
            </span>
          ) : null}
        </div>
      </header>
      {management}
      <dl className="project-facts">
        <Fact label="Lead" value={project.lead.name} />
        <Fact
          label="Target date"
          value={shortProjectDate(project.targetDate)}
        />
        <Fact
          label="Teams"
          value={
            project.teams.length
              ? project.teams.map((team) => team.name).join(", ")
              : "No project issues yet"
          }
        />
        <Fact label="Progress" value={projectProgressLabel(project)} />
      </dl>
      {project.health === "blocked" || project.health === "at-risk" ? (
        <RiskEvidence project={project} />
      ) : null}
      <ProjectCycleHistory history={project.cycleHistory}/>
      <div className="project-detail__grid">
        <section className="project-detail__section">
          <h2>Issues</h2>
          <ProjectIssues issues={project.issues} />
        </section>
        <aside className="project-detail__aside">
          <CycleFacts project={project} />
          <DependencyFacts project={project} />
        </aside>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function RiskEvidence({ project }: { project: ProjectDetailData }) {
  return (
    <section className="project-risks" aria-labelledby="project-risk-heading">
      <div>
        <p className="stream-overline">Explainable health</p>
        <h2 id="project-risk-heading">
          Why this project is{" "}
          {activeHealthLabel(project.health)?.toLocaleLowerCase()}
        </h2>
      </div>
      <ul>
        {project.risks.map((risk) => (
          <li key={`${risk.kind}-${risk.message}`}>
            <p>{risk.message}</p>
            {risk.issueIdentifiers?.length ? (
              <div>
                {risk.issueIdentifiers.map((identifier) => (
                  <Link
                    key={identifier}
                    to="/app/issues/$identifier"
                    params={{ identifier }}
                  >
                    {identifier}
                  </Link>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectIssues({ issues }: { issues: ProjectDetailData["issues"] }) {
  if (issues.length === 0)
    return <p className="projects-empty">No issues belong to this project.</p>;
  return (
    <ul className="project-issues">
      {issues.map((issue) => (
        <li key={issue.id}>
          <Link
            to="/app/issues/$identifier"
            params={{ identifier: issue.identifier }}
          >
            <span>
              <strong>{issue.identifier}</strong>
              <b>{issue.title}</b>
            </span>
            <small>
              {issue.team.name} · {issue.status.name}
              {issue.assignee ? ` · ${issue.assignee.name}` : " · Unassigned"}
            </small>
            {issue.cycle ? (
              <em>
                {issue.cycle.name}
                {issue.estimate !== null
                  ? ` · ${issue.estimate} pts`
                  : " · Unestimated"}
              </em>
            ) : null}
            {issue.blockedBy
              .filter((dependency) => dependency.unresolved)
              .map((dependency) => (
                <em
                  className="project-issue-dependency"
                  key={dependency.identifier}
                >
                  Blocked by {dependency.identifier}
                </em>
              ))}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CycleFacts({ project }: { project: ProjectDetailData }) {
  return (
    <section className="project-detail__section">
      <h2>Cycle capacity</h2>
      {project.cycles.length === 0 ? (
        <p className="projects-empty">No project issues are in a cycle.</p>
      ) : (
        <ul className="project-fact-list">
          {project.cycles.map((cycle) => (
            <li key={cycle.id}>
              <strong>
                {cycle.team.name} · {cycle.name}
              </strong>
              <span>
                {cycle.issueCount} project issues ·{" "}
                {cycle.remainingEstimatedPoints} remaining estimated points
                {cycle.unestimatedIssueCount
                  ? ` · ${cycle.unestimatedIssueCount} unestimated`
                  : ""}
              </span>
              <small>
                {cycle.capacity === null
                  ? "Capacity is not recorded."
                  : `${cycle.capacity} point capacity`}{" "}
                ·{" "}
                {new Intl.DateTimeFormat(undefined, {
                  month: "short",
                  day: "numeric",
                }).format(new Date(cycle.startsAt))}
                –
                {new Intl.DateTimeFormat(undefined, {
                  month: "short",
                  day: "numeric",
                }).format(new Date(cycle.endsAt))}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DependencyFacts({ project }: { project: ProjectDetailData }) {
  return (
    <section className="project-detail__section">
      <h2>Dependencies</h2>
      {project.dependencies.length === 0 ? (
        <p className="projects-empty">No issue dependencies are recorded.</p>
      ) : (
        <ul className="project-fact-list">
          {project.dependencies.map((dependency) => (
            <li
              key={`${dependency.blockedIssue.identifier}-${dependency.blockingIssue.identifier}`}
            >
              <span>
                <Link
                  to="/app/issues/$identifier"
                  params={{ identifier: dependency.blockedIssue.identifier }}
                >
                  {dependency.blockedIssue.identifier}
                </Link>{" "}
                depends on{" "}
                <Link
                  to="/app/issues/$identifier"
                  params={{ identifier: dependency.blockingIssue.identifier }}
                >
                  {dependency.blockingIssue.identifier}
                </Link>
              </span>
              <small>
                {dependency.unresolved
                  ? `${dependency.blockingIssue.status.name} is unresolved.`
                  : `${dependency.blockingIssue.status.name} is resolved.`}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
