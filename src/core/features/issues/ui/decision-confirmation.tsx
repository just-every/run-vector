import { useApiResource } from "../../../app/api-client";
import { currentStreamSchema, myWorkSchema } from "../../streams/ui/data";
import type { IssueDetailData } from "./data";
export function DecisionConfirmation({
  issue,
  operatorId,
}: {
  issue: IssueDetailData;
  operatorId?: string;
}) {
  const latest = [...issue.decisions].sort((a, b) =>
    b.at.localeCompare(a.at),
  )[0];
  if (!latest || !["accepted", "deferred", "declined"].includes(latest.kind))
    return null;
  const accepted = latest.kind === "accepted";
  const deferred = latest.kind === "deferred";
  const activeDeferral = deferred && issue.deferredUntil !== null;
  if (deferred && !activeDeferral)
    return (
      <details className="decision-confirmation decision-confirmation--ended">
        <summary>Deferral ended · awaiting decision</summary>
        <p>
          {latest.actor ?? "Workspace"} ·{" "}
          {latest.reason ?? "No reason recorded."}
        </p>
        <p>
          This issue is ready for a new decision. Its earlier deferral remains
          in history.
        </p>
        <a href="/app/issues">View in Issues →</a>
      </details>
    );
  return (
    <section
      className="decision-confirmation"
      role="status"
      aria-label="Saved triage decision"
    >
      <strong>
        {accepted
          ? "Accepted"
          : deferred
            ? activeDeferral
              ? "Deferred"
              : "Deferral ended · awaiting decision"
            : "Declined"}{" "}
        · {latest.actor ?? "Workspace"}
      </strong>
      {latest.reason ? <p>{latest.reason}</p> : <p>No reason recorded.</p>}
      <p>
        {deferred
          ? activeDeferral
            ? `Returns for decision ${latest.returnAt ? new Date(latest.returnAt).toLocaleString() : "when the deferral ends"}.`
            : "This issue is ready for a new decision. Its earlier deferral remains in history."
          : accepted
            ? `${issue.assignee?.name ?? "Unassigned"} · ${issue.status.name} · ${issue.priority === "none" ? "No priority" : issue.priority}.`
            : "The issue remains available with its evidence and history."}
      </p>
      <div>
        <a href="/app/issues">View in Issues →</a>
        {accepted ? (
          <AcceptedDestinations
            key={`${issue.identifier}:${issue.version}:${issue.updatedAt}`}
            issue={issue}
            operatorId={operatorId}
          />
        ) : null}
      </div>
    </section>
  );
}

// Each saved issue identity mounts its own native resource controller once.
// Remounting clears old memberships synchronously and disposes late receipts;
// an immediate reload would cancel the hook's initial request.
function AcceptedDestinations({
  issue,
  operatorId,
}: {
  issue: IssueDetailData;
  operatorId?: string;
}) {
  const stream = useApiResource("/api/current", currentStreamSchema);
  const currentSection = stream.data
    ? Object.entries(stream.data.sections).find(([, items]) =>
        items.some(
          (item) =>
            item.identifier === issue.identifier &&
            item.updatedAt === issue.updatedAt,
        ),
      )?.[0]
    : undefined;
  const currentLabel =
    currentSection === "now"
      ? "Now"
      : currentSection === "next"
        ? "Next"
        : currentSection === "recently-done"
          ? "Recently done"
          : "Needs decision";
  return (
    <>
      {issue.assignee && issue.assignee.id === operatorId ? (
        <MyWorkDestination issue={issue} />
      ) : null}
      {currentSection ? <a href="/app">Current · {currentLabel} →</a> : null}
      {stream.error ? (
        <span role="alert">
          Current destination could not be checked: {stream.error.message}
        </span>
      ) : null}
    </>
  );
}

function MyWorkDestination({ issue }: { issue: IssueDetailData }) {
  const work = useApiResource("/api/my-work", myWorkSchema);
  const inMyWork = work.data
    ? Object.values(work.data.sections)
        .flat()
        .some(
          (item) =>
            item.identifier === issue.identifier &&
            item.updatedAt === issue.updatedAt,
        )
    : false;
  return (
    <>
      {inMyWork ? <a href="/app/my-work">My work →</a> : null}
      {work.error ? (
        <span role="alert">
          My work destination could not be checked: {work.error.message}
        </span>
      ) : null}
    </>
  );
}
