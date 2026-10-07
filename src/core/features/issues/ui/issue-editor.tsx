import { useState } from "react";
import "./issue-editor.css";
import { ApiError, fetchJson } from "../../../app/api-client";
import { issueDetailSchema, type IssueDetailData } from "./data";
import type { StreamOptions } from "../../streams/ui/data";
export function IssueEditor({
  issue,
  options,
  onRefresh,
}: {
  issue: IssueDetailData;
  options: StreamOptions | null;
  onRefresh: () => void;
}) {
  const [snapshot, setSnapshot] = useState<{
      issue: IssueDetailData;
      revision: number;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const editing = snapshot?.issue;
  const stale = editing ? issue.version > editing.version : false;

  async function reloadCurrent() {
    if (!snapshot || busy) return;
    setBusy(true);
    setError("");
    try {
      const current = await fetchJson(
        `/api/issues/${snapshot.issue.identifier}`,
        issueDetailSchema,
      );
      // Replace defaults only after the operator explicitly reloads and the
      // current record passes validation. A failed reload preserves their draft.
      setSnapshot({
        issue: structuredClone(current),
        revision: snapshot.revision + 1,
      });
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const labelIds = form.getAll("labelIds").map(String);
    const statusId = String(form.get("status") ?? editing.status.id);
    const statusCategory =
      options?.statuses.find((status) => status.id === statusId)?.category ??
      editing.status.category;
    const cycleId = String(form.get("cycle") ?? "") || null;
    if (labelIds.length > 20) {
      setError("Choose at most 20 labels.");
      setBusy(false);
      return;
    }
    if (
      ["completed", "canceled", "duplicate"].includes(statusCategory) &&
      cycleId !== null &&
      cycleId !== editing.cycle?.id
    ) {
      setError(
        "Terminal work can retain its existing cycle or be uncommitted. Choose No cycle before saving.",
      );
      setBusy(false);
      return;
    }
    const estimate = String(form.get("estimate") ?? "");
    const body = {
      expectedVersion: editing.version,
      title: form.get("title"),
      description: form.get("description"),
      priority: form.get("priority"),
      assigneeOperatorId: form.get("assignee") || null,
      projectId: form.get("project") || null,
      cycleId,
      dueDate: form.get("dueDate") || null,
      estimate: estimate === "" ? null : Number(estimate),
      labelIds,
      expectedOutcome: form.get("expectedOutcome") || null,
      customerImpact: form.get("customerImpact") || null,
      ...(!["intake", "duplicate"].includes(editing.status.category)
        ? { statusId: form.get("status") }
        : {}),
    };
    try {
      await fetchJson(`/api/issues/${editing.identifier}`, issueDetailSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSnapshot(null);
      onRefresh();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? "This issue changed. Reload before applying your edit."
          : e instanceof Error
            ? e.message
            : "Update failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-section">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setSnapshot(
            snapshot ? null : { issue: structuredClone(issue), revision: 0 },
          );
          setError("");
        }}
      >
        {snapshot ? "Cancel edit" : "Edit issue"}
      </button>
      {snapshot && editing ? (
        <form
          className="issue-mutation-form"
          key={`${editing.identifier}:${snapshot.revision}`}
          onSubmit={submit}
          onInvalidCapture={(event) => {
            if (!(event.target instanceof HTMLElement)) return;
            const context = event.target.closest<HTMLDetailsElement>(
              ".issue-editor-context",
            );
            // Reveal the existing controls before native validation focuses
            // the invalid field; opening the disclosure never resets the draft.
            if (context) context.open = true;
          }}
        >
          <fieldset
            className="issue-editor-controls"
            disabled={busy}
            aria-label="Issue edit fields"
          >
            <IssueEditFields issue={editing} options={options} />
            <button type="submit" disabled={busy || !options}>
              {busy ? "Saving…" : "Save changes"}
            </button>
            {error || stale ? (
              <p role="alert">
                {error ||
                  "This issue changed. Your unsaved edit has been kept. Reload before applying it."}{" "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reloadCurrent()}
                >
                  Reload issue
                </button>
              </p>
            ) : null}
          </fieldset>
        </form>
      ) : null}
    </section>
  );
}

function IssueEditFields({
  issue,
  options,
}: {
  issue: IssueDetailData;
  options: StreamOptions | null;
}) {
  const [statusId, setStatusId] = useState(issue.status.id);
  const [cycleId, setCycleId] = useState(issue.cycle?.id ?? "");
  const [selectedLabels, setSelectedLabels] = useState(issue.labels);
  const labelIds = selectedLabels.map((label) => label.id);
  const statuses =
    options?.statuses.filter(
      (status) =>
        status.teamId === issue.team.id &&
        !["intake", "duplicate"].includes(status.category),
    ) ?? [];
  const cycles =
    options?.cycles.filter((cycle) => cycle.teamId === issue.team.id) ?? [];
  const statusCategory =
    statuses.find((status) => status.id === statusId)?.category ??
    issue.status.category;
  const terminal = ["completed", "canceled", "duplicate"].includes(
    statusCategory,
  );
  const cycleUnavailable =
    cycleId !== "" && !cycles.some((cycle) => cycle.id === cycleId);
  const availableLabels = options?.labels ?? [];
  const labels = [
    ...availableLabels,
    ...[...issue.labels, ...selectedLabels].filter(
      (label, index, stored) =>
        !availableLabels.some((available) => available.id === label.id) &&
        stored.findIndex((existing) => existing.id === label.id) === index,
    ),
  ];
  return (
    <>
      <label>
        Title
        <input
          name="title"
          required
          maxLength={500}
          defaultValue={issue.title}
        />
      </label>
      <label>
        Description
        <textarea
          name="description"
          maxLength={100_000}
          defaultValue={issue.description}
        />
      </label>
      <div className="detail-section--two">
        <label>
          Priority
          <select name="priority" defaultValue={issue.priority}>
            {["urgent", "high", "medium", "low", "none"].map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
        <HistoricalChoice
          label="Assignee"
          name="assignee"
          emptyLabel="Unassigned"
          current={issue.assignee}
          choices={options?.operators ?? []}
        />
      </div>
      {!["intake", "duplicate"].includes(issue.status.category) ? (
        <label>
          Status
          <select
            name="status"
            value={statusId}
            onChange={(event) => setStatusId(event.target.value)}
          >
            {!statuses.some((status) => status.id === statusId) ? (
              <option value={statusId}>
                {statusId === issue.status.id
                  ? issue.status.name
                  : "Selected status"}{" "}
                (historical / unavailable)
              </option>
            ) : null}
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <details className="issue-editor-context">
        <summary>
          More context <span className="issue-editor-hint">Optional</span>
        </summary>
        <div className="issue-editor-context-fields">
          <div className="detail-section--two">
            <HistoricalChoice
              label="Project"
              name="project"
              emptyLabel="No project"
              current={issue.project}
              choices={options?.projects ?? []}
            />
            <label>
              Cycle
              <select
                name="cycle"
                value={cycleId}
                onChange={(event) => setCycleId(event.target.value)}
              >
                <option value="">No cycle</option>
                {cycleUnavailable ? (
                  <option value={cycleId}>
                    {cycleId === issue.cycle?.id
                      ? issue.cycle.name
                      : "Selected cycle"}{" "}
                    (historical / unavailable)
                  </option>
                ) : null}
                {cycles.map((cycle) => (
                  <option
                    key={cycle.id}
                    value={cycle.id}
                    disabled={
                      terminal &&
                      cycle.id !== issue.cycle?.id &&
                      cycle.id !== cycleId
                    }
                  >
                    {cycle.name}
                  </option>
                ))}
              </select>
              {terminal ? (
                <span className="issue-editor-hint">
                  Terminal work can retain its existing cycle or be uncommitted.
                </span>
              ) : null}
            </label>
            <label>
              Estimate<span className="issue-editor-hint">Points</span>
              <input
                name="estimate"
                type="number"
                min="1"
                max="100"
                step="1"
                defaultValue={issue.estimate ?? ""}
              />
            </label>
            <label>
              Due date
              <input
                name="dueDate"
                type="date"
                defaultValue={issue.dueDate ?? ""}
              />
            </label>
          </div>
          <fieldset className="issue-editor-labels">
            <legend>
              Labels <span>Choose up to 20</span>
            </legend>
            {labels.length === 0 ? (
              <span className="issue-editor-hint">
                No labels are available.
              </span>
            ) : (
              <div>
                {labels.map((label) => (
                  <label key={label.id}>
                    <input
                      name="labelIds"
                      type="checkbox"
                      value={label.id}
                      checked={labelIds.includes(label.id)}
                      disabled={
                        !labelIds.includes(label.id) && labelIds.length >= 20
                      }
                      onChange={(event) =>
                        setSelectedLabels((current) =>
                          event.target.checked
                            ? [...current, label]
                            : current.filter(
                                (selected) => selected.id !== label.id,
                              ),
                        )
                      }
                    />
                    <i style={{ background: label.color }} aria-hidden="true" />
                    {label.name}
                    {!availableLabels.some(
                      (available) => available.id === label.id,
                    )
                      ? " (unavailable)"
                      : ""}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div className="detail-section--two">
            <label>
              Expected outcome
              <textarea
                name="expectedOutcome"
                maxLength={20_000}
                defaultValue={issue.expectedOutcome ?? ""}
              />
            </label>
            <label>
              Customer impact
              <textarea
                name="customerImpact"
                maxLength={20_000}
                defaultValue={issue.customerImpact ?? ""}
              />
            </label>
          </div>
        </div>
      </details>
    </>
  );
}

function HistoricalChoice({
  label,
  name,
  emptyLabel,
  current,
  choices,
}: {
  label: string;
  name: string;
  emptyLabel: string;
  current: { id: string; name: string } | null;
  choices: Array<{ id: string; name: string }>;
}) {
  const [selected, setSelected] = useState(current);
  const unavailable =
    selected !== null && !choices.some((choice) => choice.id === selected.id);
  return (
    <label>
      {label}
      <select
        name={name}
        value={selected?.id ?? ""}
        onChange={(event) =>
          setSelected(
            choices.find((choice) => choice.id === event.target.value) ??
              (selected?.id === event.target.value ? selected : null),
          )
        }
      >
        <option value="">{emptyLabel}</option>
        {unavailable ? (
          <option value={selected.id}>
            {selected.name} (historical / unavailable)
          </option>
        ) : null}
        {choices.map((choice) => (
          <option value={choice.id} key={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
    </label>
  );
}
