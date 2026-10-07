import { useState, type FormEvent } from "react";
import { ApiError, fetchJson } from "../../../app/api-client";
import type { StreamOptions } from "../../streams/ui/data";
import { issueDetailSchema, type IssueDetailData } from "./data";

type DecisionPanelProps = {
  issue: IssueDetailData;
  options: StreamOptions | null;
  optionsError: Error | null;
  onRefresh: () => void;
};

type DecisionKind = "accept" | "defer" | "decline" | "return";

export function DecisionPanel({
  issue,
  options,
  optionsError,
  onRefresh,
}: DecisionPanelProps) {
  const [selectedKind, setKind] = useState<DecisionKind>("accept");
  const kind =
    selectedKind === "return" && !issue.deferredUntil ? "accept" : selectedKind;
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accept, setAccept] = useState({
    assigneeOperatorId: "",
    priority: "high",
    statusId: "",
    cycleId: "",
    reason: "",
  });
  const [defer, setDefer] = useState({ returnAt: "", reason: "" });
  const [declineReason, setDeclineReason] = useState("");
  if (issue.status.category !== "intake") return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const path = kind;
    let body: Record<string, unknown> = { expectedVersion: issue.version };
    if (kind === "accept") {
      body = {
        ...body,
        assigneeOperatorId: accept.assigneeOperatorId || null,
        priority: accept.priority,
        cycleId: accept.cycleId || null,
        reason: accept.reason || undefined,
        ...(accept.statusId ? { statusId: accept.statusId } : {}),
      };
    }
    if (kind === "defer") {
      const returnDate = new Date(defer.returnAt);
      if (Number.isNaN(returnDate.getTime())) {
        setMessage("Choose a future return time.");
        return;
      }
      body = {
        ...body,
        returnAt: returnDate.toISOString(),
        reason: defer.reason || undefined,
      };
    }
    if (kind === "decline") body = { ...body, reason: declineReason };
    setSubmitting(true);
    try {
      await fetchJson(
        `/api/issues/${issue.identifier}/${path}`,
        issueDetailSchema,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setMessage(
        `${kind === "accept" ? "Accepted" : kind === "defer" ? "Deferred" : kind === "return" ? "Returned for decision" : "Declined"} and refreshed from the workspace.`,
      );
      onRefresh();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        typeof error.body === "object" &&
        error.body !== null &&
        "error" in error.body &&
        error.body.error === "stale_version"
      ) {
        setMessage(
          "This issue changed elsewhere. The current version has been loaded; review it before submitting again.",
        );
        onRefresh();
      } else {
        setMessage(
          error instanceof Error
            ? error.message
            : "The decision could not be saved.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const teamStatuses =
    options?.statuses.filter(
      (status) =>
        status.teamId === issue.team.id &&
        ["started", "unstarted"].includes(status.category),
    ) ?? [];
  const teamCycles =
    options?.cycles.filter((cycle) => cycle.teamId === issue.team.id) ?? [];
  return (
    <section className="decision-panel" aria-labelledby="decision-heading">
      <div className="decision-heading">
        <div>
          <h2 id="decision-heading">Make the triage call</h2>
        </div>
      </div>
      <div
        className="decision-tabs"
        role="tablist"
        aria-label="Intake decisions"
      >
        {(
          [
            "accept",
            "defer",
            "decline",
            ...(issue.deferredUntil ? ["return" as const] : []),
          ] as const
        ).map((item) => (
          <button
            type="button"
            key={item}
            role="tab"
            aria-selected={kind === item}
            className={kind === item ? "is-active" : ""}
            disabled={submitting}
            onClick={() => setKind(item)}
          >
            {item === "return"
              ? "End deferral"
              : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {optionsError ? (
        <p className="form-message form-message--error" role="alert">
          Available assignees and workflow choices could not be loaded:{" "}
          {optionsError.message}
        </p>
      ) : null}
      <form onSubmit={submit} className="decision-form">
        <fieldset className="decision-controls" disabled={submitting}>
          {kind === "accept" ? (
            <>
              <label>
                Assignee
                <select
                  value={accept.assigneeOperatorId}
                  disabled={options === null}
                  onChange={(event) =>
                    setAccept({
                      ...accept,
                      assigneeOperatorId: event.target.value,
                    })
                  }
                >
                  <option value="">Leave unassigned</option>
                  {options?.operators.map((operator) => (
                    <option key={operator.id} value={operator.id}>
                      {operator.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select
                  value={accept.priority}
                  onChange={(event) =>
                    setAccept({ ...accept, priority: event.target.value })
                  }
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="none">No priority</option>
                </select>
              </label>
              <label>
                Start status
                <select
                  value={accept.statusId}
                  disabled={options === null}
                  onChange={(event) =>
                    setAccept({ ...accept, statusId: event.target.value })
                  }
                >
                  <option value="">Default unstarted status</option>
                  {teamStatuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cycle
                <select
                  value={accept.cycleId}
                  disabled={options === null}
                  onChange={(event) =>
                    setAccept({ ...accept, cycleId: event.target.value })
                  }
                >
                  <option value="">No cycle</option>
                  {teamCycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="decision-form__wide">
                Reason <span>(optional)</span>
                <textarea
                  value={accept.reason}
                  onChange={(event) =>
                    setAccept({ ...accept, reason: event.target.value })
                  }
                  rows={2}
                />
              </label>
            </>
          ) : null}
          {kind === "defer" ? (
            <>
              <label>
                Return for decision
                <input
                  type="datetime-local"
                  required
                  value={defer.returnAt}
                  onChange={(event) =>
                    setDefer({ ...defer, returnAt: event.target.value })
                  }
                />
              </label>
              <label className="decision-form__wide">
                Reason <span>(optional)</span>
                <textarea
                  value={defer.reason}
                  onChange={(event) =>
                    setDefer({ ...defer, reason: event.target.value })
                  }
                  rows={3}
                />
              </label>
            </>
          ) : null}
          {kind === "return" ? (
            <p className="decision-form__wide">
              Return this issue to Needs decision now. Its earlier deferral
              remains in triage history.
            </p>
          ) : null}
          {kind === "decline" ? (
            <label className="decision-form__wide">
              Reason <span>(required)</span>
              <textarea
                required
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
                rows={3}
              />
            </label>
          ) : null}
          <div className="decision-actions">
            <button
              className={`decision-submit decision-submit--${kind}`}
              type="submit"
              disabled={submitting || (kind === "accept" && options === null)}
            >
              {submitting
                ? "Saving…"
                : kind === "accept"
                  ? "Accept and route work"
                  : kind === "defer"
                    ? "Defer decision"
                    : kind === "return"
                      ? "End deferral now"
                      : "Decline issue"}
            </button>
          </div>
        </fieldset>
      </form>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
