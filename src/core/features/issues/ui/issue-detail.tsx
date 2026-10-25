import {DocumentsSection} from '../../documents/ui/list';
import {IssueSpecification} from '../../documents/ui/specification';
import { TooltipScope } from '../../../ui/tooltip';
import { IssueReferencesProvider } from '../../issue-references/ui/context';
import { IssueActivityTitle } from '../../issue-references/ui/activity';
import {IssueReleases} from '../../releases/ui/releases';
import { IssueCopyAction } from "../../issue-copy/ui";
import { Subissues } from "../../subissues/ui/subissues";
import { IssueDescription } from "../../description-history/ui/description";
import { useNavigate } from '@tanstack/react-router';
import { DeleteIssue,type DeletionReceipt } from '../../issue-deletion/ui';
import { IssueDuplicates } from '../../duplicates/ui';
import { GithubBranch } from '../../integrations/ui/github-branch';
import { GithubLinks } from '../../integrations/ui/github-links';
import { isEditableTarget } from "../../search/ui/command-helpers";
import { IssueSubscriptionControls } from "../../notifications/ui/issue-subscription";
import { PersonalReminderControls } from "../../notifications/ui/personal-reminders";
import { IssueLabels } from "./issue-labels";
import { IssueProperties } from "./issue-properties";
import { IssueParent, hierarchyIsEmpty, type HierarchyState } from "./issue-parent";
import { DecisionConfirmation } from "./decision-confirmation";
import { IssueEditor } from "./issue-editor";
import { IssueFieldEditor } from "./issue-field-editor";
import { TeamMove } from "./team-move";
import { Dependencies } from "./dependencies";
import { Discussion } from "./discussion";
import { isSafeHttpsUrl } from "../../links/schema";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiError, useApiResource } from "../../../app/api-client";
import { optionsSchema, type StreamOptions } from "../../streams/ui/data";
import { relativeTime } from "../../streams/ui/helpers";
import { DecisionPanel } from "./decision-panel";
import { activityChanges } from "./activity-changes";
import { issueDetailSchema, type IssueDetailData } from "./data";
import { useViewerTime } from "../../../app/viewer-time";

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
  const detail = useApiResource(`/api/issues/${identifier}`, issueDetailSchema, undefined, { abortPendingOnDispose: false });
  const options = useApiResource("/api/options", optionsSchema);
  const navigate=useNavigate();
  const [committed,setCommitted]=useState<IssueDetailData|null>(null);
  const currentIdentifier = useRef(identifier);
  currentIdentifier.current = identifier;
  useEffect(() => {
    window.addEventListener('vector:issues-changed', detail.refreshAfterMutation);
    return () => window.removeEventListener('vector:issues-changed', detail.refreshAfterMutation);
  }, [detail.refreshAfterMutation]);
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
  const refresh = (receipt?: IssueDetailData) => {
    if (receipt) {
      if (receipt.identifier !== currentIdentifier.current) return;
      // Share the committed version while the admitted detail read drains.
      setCommitted((current) =>
        current?.identifier === receipt.identifier &&
        current.version > receipt.version
          ? current
          : receipt,
      );
    }
    detail.refreshAfterMutation();
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
      <TooltipScope><IssueReferencesProvider identifier={identifier} revision={detail.data.version}><IssueInspector
        issue={committed?.identifier===detail.data.identifier&&committed.version>detail.data.version?committed:detail.data}
        onBack={onBack}
        onRefresh={refresh}
        options={options.data}
        onDeleted={receipt=>{onChanged?.();window.dispatchEvent(new Event("vector:issues-changed"));window.dispatchEvent(new CustomEvent("vector:issue-deleted",{detail:receipt}));if(onBack)onBack();else void navigate({to:"/app/issues"});}}
        optionsError={options.error}
      /></IssueReferencesProvider></TooltipScope>
    </>
  );
}

function IssueInspector({
  issue,
  onBack,
  onRefresh,
  options,
  optionsError,
  onDeleted,
}: {
  issue: IssueDetailData;
  onDeleted:(receipt:DeletionReceipt)=>void;
  onBack?: () => void;
  onRefresh: (receipt?: IssueDetailData) => void;
  options: StreamOptions | null;
  optionsError: Error | null;
}) {
  const writable = !!options && options.operator.role !== 'viewer';
  const { formatInstant } = useViewerTime();
  const [hierarchy, setHierarchy] = useState<HierarchyState & { id: string }>({
    id: issue.identifier,
    editing: false,
    message: "",
  });
  const hierarchyState =
    hierarchy.id === issue.identifier
      ? hierarchy
      : { id: issue.identifier, editing: false, message: "" };
  const parentTrigger = useRef<HTMLButtonElement>(null);
  const restoreParentFocus = useRef(false);
  const onHierarchy = (next: HierarchyState) => {
    if (hierarchyState.editing && !next.editing) restoreParentFocus.current = true;
    setHierarchy({ ...next, id: issue.identifier });
  };
  useLayoutEffect(() => {
    if (restoreParentFocus.current && !hierarchyState.editing && parentTrigger.current) {
      parentTrigger.current.focus();
      restoreParentFocus.current = false;
    }
  });
  const compactHierarchy = hierarchyIsEmpty(issue, hierarchyState);
  return (
    <article
      className={`issue-inspector${issue.status.category === "intake" ? " issue-inspector--intake" : ""}`}
      aria-labelledby="issue-title"
    >
      <header className="issue-header">
        <div>
          <div className="issue-header-context">
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
              {issue.identifier} · {issue.team.name} · updated{" "}
              {relativeTime(issue.updatedAt)}
            </p>
            {issue.importedFrom ? (
              <p className="detail-kicker">
                Imported from {issue.importedFrom.sourceKey??issue.importedFrom.sourceId}{issue.importedFrom.sourceKey?` · source ID ${issue.importedFrom.sourceId}`:''} ({issue.importedFrom.source})
                {issue.importedFrom.unfinished ? " · part of an unfinished import run" : ""}
              </p>
            ) : null}
          </div>
          <h1 id="issue-title">{issue.title}</h1>
          {issue.archivedAt && (
            <p className="issue-archived-notice" role="note">
              Archived {formatInstant(issue.archivedAt)}. It is left out of lists and default search; choosing another status brings it back.
            </p>
          )}
          <div className="issue-header-actions">
            {writable && <IssueCopyAction key={`copy:${issue.identifier}`} identifier={issue.identifier} onRefresh={onRefresh} />}
            {writable && <IssueEditor
              key={`issue-editor:${issue.identifier}`}
              issue={issue}
              onRefresh={onRefresh}
            />}
            {writable && <IssueSubscriptionControls
              key={`issue-subscription:${issue.identifier}`}
              identifier={issue.identifier}
            />}
            {/* With no parent or children, Set parent sits with the issue actions. */}
            {compactHierarchy ? (
              <IssueParent writable={writable}
                key={issue.identifier + ":parent"}
                issue={issue}
                onRefresh={onRefresh}
                triggerRef={parentTrigger}
                state={hierarchyState}
                onState={onHierarchy}
                compact
              />
            ) : null}
          </div>
        </div>
      </header>
      {writable && <PersonalReminderControls key={`personal-reminders:${issue.identifier}`} identifier={issue.identifier} />}
      {writable && <DecisionConfirmation
        key={issue.identifier + ":confirmation"}
        issue={issue}
        operatorId={options?.operator.id}
      />}
      <IssueProperties writable={writable}
        key={issue.identifier}
        issue={issue}
        options={options}
        onRefresh={onRefresh}
      />
      <GithubBranch identifier={issue.identifier} title={issue.title}/>
      <IssueReleases identifier={issue.identifier}/>
      <div className="issue-body">
        <div className="issue-planning-fields">
          <IssueFieldEditor writable={writable}
            key={issue.identifier + ":estimate"}
            issue={issue}
            field="estimate"
            onRefresh={onRefresh}
          />
          <IssueFieldEditor writable={writable}
            key={issue.identifier + ":due-date"}
            issue={issue}
            field="dueDate"
            onRefresh={onRefresh}
          />
        </div>
        {/* Labels and hierarchy share a wrapping row so short ones sit side by side. */}
        <div className="issue-relations">
          <IssueLabels writable={writable}
            key={issue.identifier + ":labels"}
            issue={issue}
            options={options}
            onRefresh={onRefresh}
          />
          {compactHierarchy ? null : (
            <IssueParent writable={writable}
              key={issue.identifier + ":parent"}
              issue={issue}
              onRefresh={onRefresh}
              triggerRef={parentTrigger}
              state={hierarchyState}
              onState={onHierarchy}
            />
          )}
          <Subissues writable={writable} key={issue.identifier + ":subissues"} issue={issue} onRefresh={onRefresh} />
        </div>
        <IssueDescription writable={writable} issue={issue} onRefresh={onRefresh} />
        {issue.evidence.map((evidence) => (
          <EvidenceInspector
            key={evidence.id}
            evidence={evidence}
            operators={options?.operators ?? []}
          />
        ))}
        <details className="detail-section issue-outcome" open>
          <summary>Outcome and customer impact</summary>
          <section className="detail-section detail-section--two">
            <IssueFieldEditor writable={writable}
              key={issue.identifier + ":outcome"}
              issue={issue}
              field="expectedOutcome"
              onRefresh={onRefresh}
            />
            <IssueFieldEditor writable={writable}
              key={issue.identifier + ":impact"}
              issue={issue}
              field="customerImpact"
              onRefresh={onRefresh}
            />
          </section>
        </details>
        <details className="secondary-section">
          <summary>Relationships · {issue.dependencies.length}</summary>
          <Dependencies writable={writable}
            key={issue.identifier + ":dependencies"}
            issue={issue}
            onRefresh={onRefresh}
          />
        </details>
        <IssueDuplicates writable={writable} issue={issue} onRefresh={onRefresh}/>
        {writable && <TeamMove
          key={issue.identifier + ":team-move"}
          issue={issue}
          options={options}
          optionsError={optionsError}
          onRefresh={onRefresh}
        />}
        {writable && <DeleteIssue issue={issue} onDeleted={onDeleted} onRefresh={onRefresh}/>}
        <IssueSpecification identifier={issue.identifier} writable={writable}/><DocumentsSection parentKind="issue" parentId={issue.id}/><GithubLinks identifier={issue.identifier}/><Discussion writable={writable}
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
                      <strong><IssueActivityTitle kind={activity.kind} nextValue={activity.nextValue}/></strong>
                      <span>
                        {activity.actor ?? "System"} ·{" "}
                        {relativeTime(activity.at)}
                      </span>
                      {activityChanges(activity.kind, activity.previousValue, activity.nextValue, options).map((change) => (
                        <span className="activity-change" key={change.field}>
                          {change.from === undefined ? `${change.field} edited` : `${change.field}: ${change.from} → ${change.to}`}
                        </span>
                      ))}
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
                        {decision.actor ?? "System"} ·{" "}
                        {relativeTime(decision.at)}
                        {decision.reason ? ` · ${decision.reason}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </details>
        ) : null}
      </div>
      {writable && issue.status.category === "intake" ? (
        <DecisionPanel
          key={issue.identifier + ":decision"}
          issue={issue}
          options={options}
          optionsError={optionsError}
          onRefresh={onRefresh}
        />
      ) : null}
    </article>
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
      {evidence.sourceId&&<p>Source {evidence.sourceId} · record {evidence.sourceRecordId} · revision {evidence.sourceRevisionId}</p>}
      {evidence.changes.length>0&&<details className="evidence-context"><summary>Changes from the preceding observed revision</summary><dl className="evidence-metrics">{evidence.changes.map(change=><div key={change.field}><dt>{humanize(change.field)}</dt><dd>{renderValue(change.previous)} → {renderValue(change.current)}</dd></div>)}</dl></details>}
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
      <details className="evidence-context">
        <summary>Measurements and assessment</summary>
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
      </details>
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
  const source = typeof value.source === "string" ? value.source : value.attribution === "source" ? "source" : "recorded";
  if (source === "source" && (value.value === null || typeof value.value === "number" || typeof value.value === "boolean"))
    return [{ key, value: String(value.value), source }];
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
