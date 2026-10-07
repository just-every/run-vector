import { isEditableTarget } from "../../search/ui/command-helpers";
import { IssueEditor } from "./issue-editor";
import { TeamMove } from "./team-move";
import { Dependencies } from "./dependencies";
import { Discussion } from "./discussion";
import { SafeMarkdown } from "../../markdown/ui/markdown";
import { isSafeHttpsUrl } from "../../links/schema";
import { useEffect } from "react";
import { ApiError, useApiResource } from "../../../app/api-client";
import { optionsSchema, type StreamOptions } from "../../streams/ui/data";
import { relativeTime, shortDate } from "../../streams/ui/helpers";
import { DecisionPanel } from "./decision-panel";
import { issueDetailSchema, type IssueDetailData } from "./data";

type IssueDetailProps = {
  identifier: string;
  onBack?: () => void;
  onChanged?: () => void;
};

export function IssueDetail({
  identifier,
  onBack,
  onChanged,
}: IssueDetailProps) {
  const detail = useApiResource(`/api/issues/${identifier}`, issueDetailSchema);
  const options = useApiResource("/api/options", optionsSchema);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        !onBack ||
        event.defaultPrevented ||
        isEditableTarget(
          event.target instanceof HTMLElement ? event.target : null,
        )
      )
        return;
      event.preventDefault();
      onBack();
      window.setTimeout(
        () => document.getElementById(`issue-row-${identifier}`)?.focus(),
        0,
      );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [identifier, onBack]);
  if (detail.loading && detail.data === null)
    return (
      <div className="issue-state" aria-live="polite">
        Loading issue…
      </div>
    );
  if (detail.data === null)
    return (
      <div className="issue-state issue-state--error" role="alert">
        <strong>Unable to load {identifier}.</strong>
        <span>{detail.error?.message}</span>
        {detail.error instanceof ApiError && detail.error.status === 401 ? (
          <a
            href={`/signin?returnTo=${encodeURIComponent(`/app/issues/${identifier}`)}`}
          >
            Sign in again
          </a>
        ) : (
          <button type="button" onClick={detail.reload}>
            Try again
          </button>
        )}
      </div>
    );
  const refresh = () => {
    detail.reload();
    onChanged?.();
  };
  return (
    <>
      {detail.error ? (
        <div className="issue-refresh-error" role="alert">
          <span>
            Changes could not be refreshed. Your unsaved edits are retained.
          </span>
          <span>{detail.error.message}</span>
          <button type="button" onClick={detail.reload}>
            Retry refresh
          </button>
        </div>
      ) : null}
      <IssueInspector
        issue={detail.data}
        onBack={onBack}
        onRefresh={refresh}
        options={options.data}
        optionsError={options.error}
      />
    </>
  );
}

function IssueInspector({
  issue,
  onBack,
  onRefresh,
  options,
  optionsError,
}: {
  issue: IssueDetailData;
  onBack?: () => void;
  onRefresh: () => void;
  options: StreamOptions | null;
  optionsError: Error | null;
}) {
  return (
    <article className="issue-inspector" aria-labelledby="issue-title">
      <header className="issue-header">
        <div>
          {onBack ? (
            <button
              type="button"
              className="detail-back"
              onClick={() => {
                onBack();
                window.setTimeout(
                  () =>
                    document
                      .getElementById(`issue-row-${issue.identifier}`)
                      ?.focus(),
                  0,
                );
              }}
            >
              ← Back to list
            </button>
          ) : null}
          <p className="detail-kicker">
            {issue.identifier} · updated {relativeTime(issue.updatedAt)}
          </p>
          <h1 id="issue-title">{issue.title}</h1>
        </div>
        <div className="issue-status">
          <span>{issue.status.name}</span>
          <span className={`priority priority--${issue.priority}`}>
            {issue.priority === "none" ? "No priority" : issue.priority}
          </span>
        </div>
      </header>
      <dl className="issue-facts">
        <Fact label="Team" value={issue.team.name} />
        <Fact label="Assignee" value={issue.assignee?.name ?? "Unassigned"} />
        {issue.project ? (
          <Fact label="Project" value={issue.project.name} />
        ) : null}
        {issue.cycle ? <Fact label="Cycle" value={issue.cycle.name} /> : null}
        {issue.dueDate ? (
          <Fact label="Due" value={shortDate(issue.dueDate)} />
        ) : null}
        {issue.estimate !== null ? (
          <Fact label="Estimate" value={`${issue.estimate} points`} />
        ) : null}
      </dl>
      {issue.labels.length > 0 ? (
        <ul className="issue-labels" aria-label="Labels">
          {issue.labels.map((label) => (
            <li key={label.id}>
              <i style={{ backgroundColor: label.color }} aria-hidden="true" />
              {label.name}
            </li>
          ))}
        </ul>
      ) : null}
      {issue.description ? (
        <section className="detail-section">
          <h2>Description</h2>
          <SafeMarkdown>{issue.description}</SafeMarkdown>
        </section>
      ) : null}
      {issue.evidence.map((evidence) => (
        <EvidenceInspector
          key={evidence.id}
          evidence={evidence}
          operators={options?.operators ?? []}
        />
      ))}
      {issue.expectedOutcome || issue.customerImpact ? (
        <section className="detail-section detail-section--two">
          <div>
            {issue.expectedOutcome ? (
              <>
                <h2>Expected outcome</h2>
                <p>{issue.expectedOutcome}</p>
              </>
            ) : null}
          </div>
          <div>
            {issue.customerImpact ? (
              <>
                <h2>Customer impact</h2>
                <p>{issue.customerImpact}</p>
              </>
            ) : null}
          </div>
        </section>
      ) : null}
      {issue.status.category === "intake" ? (
        <DecisionPanel
          issue={issue}
          options={options}
          optionsError={optionsError}
          onRefresh={onRefresh}
        />
      ) : null}
      <Dependencies
        key={issue.identifier + ":dependencies"}
        issue={issue}
        onRefresh={onRefresh}
      />
      <IssueEditor
        key={issue.identifier}
        issue={issue}
        options={options}
        onRefresh={onRefresh}
      />
      <TeamMove
        key={issue.identifier + ":team-move"}
        issue={issue}
        options={options}
        optionsError={optionsError}
        onRefresh={onRefresh}
      />
      <Discussion
        key={issue.identifier + ":discussion"}
        identifier={issue.identifier}
        onRefresh={onRefresh}
      />
      {issue.activity.length > 0 || issue.decisions.length > 0 ? (
        <details className="detail-section issue-history">
          <summary>History</summary>
          {issue.activity.length > 0 ? (
            <>
              <h2>Activity</h2>
              <ol className="activity-list">
                {issue.activity.map((activity) => (
                  <li key={activity.id}>
                    <strong>{activity.kind.replaceAll(".", " ")}</strong>
                    <span>
                      {activity.actor ?? "System"} · {relativeTime(activity.at)}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
          {issue.decisions.length > 0 ? (
            <>
              <h2>Decision history</h2>
              <ol className="activity-list">
                {issue.decisions.map((decision) => (
                  <li key={decision.id}>
                    <strong>{decision.kind}</strong>
                    <span>
                      {decision.actor ?? "System"} · {relativeTime(decision.at)}
                      {decision.reason ? ` · ${decision.reason}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </details>
      ) : null}
    </article>
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

function EvidenceInspector({
  evidence,
  operators,
}: {
  evidence: IssueDetailData["evidence"][number];
  operators: Array<{ id: string; name: string }>;
}) {
  const operatorReport = evidence.originKind === "operator";
  const measurementEntries = Object.entries(evidence.measurements);
  const assertions = Object.entries(evidence.assertions).flatMap(
    ([key, value]) => toAssertion(key, value, operators),
  );
  return (
    <section
      className="evidence-inspector"
      aria-labelledby={`evidence-${evidence.id}`}
    >
      <div className="evidence-heading">
        <div>
          <p className="detail-kicker">
            {operatorReport
              ? `Operator report · ${evidence.actor ?? "Operator"}`
              : `Evidence · ${evidence.sourceName}`}
          </p>
          <h2 id={`evidence-${evidence.id}`}>Why this needs attention</h2>
        </div>
        <span>{relativeTime(evidence.observedAt)}</span>
      </div>
      <p>{evidence.summary}</p>
      {evidence.link && isSafeHttpsUrl(evidence.link) ? (
        <p>
          <a
            href={evidence.link}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Open evidence link ↗
          </a>
        </p>
      ) : null}
      {measurementEntries.length > 0 ? (
        <dl className="evidence-metrics">
          {measurementEntries.map(([key, value]) => (
            <div key={key}>
              <dt>{humanize(key)}</dt>
              <dd>{renderValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {assertions.length > 0 ? (
        <div className="assertion-list">
          {assertions.map((assertion) => (
            <div key={assertion.key}>
              <span>
                {assertion.source === "policy"
                  ? "Policy recommendation"
                  : operatorReport
                    ? "Operator assertion"
                    : "Source assertion"}
              </span>
              <strong>{humanize(assertion.key)}</strong>
              <p>{assertion.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      {evidence.customerReports.length > 0 ? (
        <div className="assertion-list" aria-label="Customer reports">
          {evidence.customerReports.map((report, index) => (
            <div key={index}>
              <span>Customer report {index + 1}</span>
              {report.customer ? <strong>{report.customer}</strong> : null}
              <p>{report.summary}</p>
              {report.link && isSafeHttpsUrl(report.link) ? (
                <a
                  href={report.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  Open report link ↗
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function renderValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : JSON.stringify(value);
}
function humanize(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toAssertion(
  key: string,
  value: unknown,
  operators: Array<{ id: string; name: string }>,
) {
  if (!isRecord(value)) return [];
  const source = typeof value.source === "string" ? value.source : "recorded";
  if (typeof value.value === "string")
    return [{ key, value: value.value, source }];
  if (source !== "policy") return [];
  const assignee =
    typeof value.assigneeOperatorId === "string"
      ? (operators.find((operator) => operator.id === value.assigneeOperatorId)
          ?.name ?? value.assigneeOperatorId)
      : null;
  const parts = [
    assignee ? `Assign to ${assignee}` : null,
    typeof value.priority === "string"
      ? `${humanize(value.priority)} priority`
      : null,
    typeof value.statusCategory === "string"
      ? `${humanize(value.statusCategory)} work`
      : null,
    typeof value.team === "string" ? value.team : null,
    value.onCall === true ? "On-call" : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? [{ key, value: parts.join(" · "), source }] : [];
}
