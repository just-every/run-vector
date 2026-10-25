import { useDateFormat } from "../../../shared/date-format";
import {SubjectSubscribe} from '../../subscriptions/ui/subscriptions';
import { ProjectChannel } from "../../integrations/ui/project-channel";
import { ProjectReportPanel } from "../../project-report/panel";
import { ProjectAppearance } from "./project-appearance";
import { ProjectMilestones } from "./project-milestones";
import { ProjectActivity } from "./project-activity";
import { RiskEvidence } from "./risk-evidence";
import { ProjectCycleHistory } from "./cycle-history";
import { SafeMarkdown } from "../../markdown/ui/markdown";
import { administrationSchema } from "../../administration/schema";
import { ProjectAdministration } from "./project-administration";
import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { isMissingResourceError, useApiResource } from "../../../app/api-client";
import { MissingResource, FailedResource } from '../../../app/ui/resource-state';
import {
  activeHealthLabel,
  lifecycleLabel,
  projectProgressLabel,
} from "./helpers";
import { projectDetailSchema, type ProjectDetailData } from "./data";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const administration = useApiResource(
    "/api/metadata",
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
    return isMissingResourceError(project.error)
      ? <MissingResource kind="project" back="/app/projects" list="Projects" />
      : <FailedResource kind="project" retry={project.reload} />;
  const record = administration.data?.projects.find(
    (item) => item.id === projectId,
  );
  return (
    <ProjectDetailContent
      project={project.data}
      milestones={<ProjectMilestones writable={!!administration.data && !["guest","viewer"].includes(administration.data.viewer.role)} project={project.data} onChanged={(receipt) => {
        project.publishReceipt(() => receipt);
        project.refreshAfterMutation();
      }} />}
      management={(!administration.data || ["guest","viewer"].includes(administration.data.viewer.role)) ? null :
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
          {record && administration.data && <ProjectChannel projectId={projectId} />}
          {record && administration.data && (
            <ProjectAdministration
              project={record}
              viewer={administration.data.viewer}
              operators={administration.data.operators}
              labels={administration.data.labels}
              onDeleted={() => void navigate({ to: "/app/projects" })}
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
  milestones,
}: {
  project: ProjectDetailData;
  management: ReactNode;
  milestones: ReactNode;
}) {
  const health = activeHealthLabel(project.health);
  const { date } = useDateFormat();
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
          <h1 id="project-title" aria-label={project.name} className="project-name"><ProjectAppearance color={project.color} icon={project.icon} />{project.name}</h1>
          <SafeMarkdown>
            {project.description || "No description has been recorded."}
          </SafeMarkdown>
        </div>
        <div className="project-detail__badges">
          <SubjectSubscribe subjectType="project" subjectId={project.id}/>
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
      {project.issues.length === 0 && <section className="project-detail__section"><h2>Issues</h2>{management ? <a href={`/app/new?project=${project.id}`}>Add the first issue</a> : <p>No issues belong to this project.</p>}</section>}
      {management}
      <dl className="project-facts">
        <Fact label="Lead" value={project.lead.name} />
        <Fact label="Start date" value={project.startDate ? date(project.startDate) : "No start date"} />
        <Fact label="Priority" value={project.priority === "none" ? "No priority" : lifecycleLabel(project.priority)} />
        <Fact label="Labels" value={project.labels.map(label=>label.name).join(", ") || "No labels"} />
        <Fact
          label="Target date"
          value={project.targetDate ? date(project.targetDate) : "No target date"}
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
      {milestones}
      {project.healthExplanation ? (
        <p className="project-health-explanation" role="status">
          {project.healthExplanation}
        </p>
      ) : null}
      {project.health === "blocked" || project.health === "at-risk" ? (
        <RiskEvidence project={project} />
      ) : null}
      {project.issues.length > 0 && <ProjectReportPanel report={project.report} />}
      {project.issues.length > 0 && <ProjectCycleHistory history={project.cycleHistory} />}
      <ProjectActivity activity={project.activity} />
      {project.issues.length > 0 && <div className="project-detail__grid">
        <section className="project-detail__section">
          <h2>Issues</h2>
          {project.issues.length === 0 && management ? <a href={`/app/new?project=${project.id}`}>Add the first issue</a> : <ProjectIssues issues={project.issues} />}
        </section>
        <aside className="project-detail__aside">
          {project.issues.length > 0 && <CycleFacts project={project} />}
          {project.issues.length > 0 && <DependencyFacts project={project} />}
        </aside>
      </div>}
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
  const { range } = useDateFormat();
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
                {range(cycle.startsAt, cycle.endsAt)}
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
