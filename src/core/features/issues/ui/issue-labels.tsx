import { administrationSchema } from "../../administration/schema";
import { useState, type FormEvent } from "react";
import { ApiError, fetchJson } from "../../../app/api-client";
import type { StreamOptions } from "../../streams/ui/data";
import { LabelChip } from "../../../app/ui/label-chip";
import { issueDetailSchema, type IssueDetailData } from "./data";
export function IssueLabels({
  issue,
  options,
  onRefresh,
}: {
  issue: IssueDetailData;
  options: StreamOptions | null;
  onRefresh: () => void;
}) {
  const [createdLabels, setCreatedLabels] = useState<NonNullable<StreamOptions>["labels"]>([]);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("#8fa3f0");
  const availableLabels = [...(options?.labels ?? []), ...createdLabels.filter(label => !options?.labels.some(existing => existing.id === label.id))];
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(
    issue.labels.map((label) => label.id),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(issue.version);
  const [conflict, setConflict] = useState(false);
  const stale = open && issue.version > version;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending || stale || conflict) return;
    setPending(true);
    setError("");
    try {
      await fetchJson(`/api/issues/${issue.identifier}`, issueDetailSchema, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: version, labelIds: selected }),
      });
      setOpen(false);
      onRefresh();
    } catch (cause) {
      setConflict(cause instanceof ApiError && cause.status === 409);
      setError(
        cause instanceof ApiError && cause.status === 409
          ? "This issue changed. Reload labels before saving again."
          : cause instanceof Error
            ? cause.message
            : "Labels could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (pending || !options?.canCreateLabels) return;
    setPending(true);
    setError("");
    try {
      const data = await fetchJson("/api/settings/labels", administrationSchema, {
        method: "POST", headers: {"content-type": "application/json"},
        body: JSON.stringify({name: labelName, color: labelColor}),
      });
      const label = data.labels.find(label => label.name === labelName.trim());
      if (!label) throw new Error("The created label could not be read. Refresh labels.");
      setCreatedLabels(labels => [...labels, label]);
      if (selected.length < options.labelsPerIssue) setSelected(labels => [...labels, label.id]);
      setLabelName("");
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Label could not be created.");
    } finally { setPending(false); }
  }
  async function reload() {
    setPending(true);
    try {
      const current = await fetchJson(
        `/api/issues/${issue.identifier}`,
        issueDetailSchema,
      );
      setSelected(current.labels.map((label) => label.id));
      setVersion(current.version);
      setConflict(false);
      setError("");
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reload failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="issue-label-control">
      <div className="issue-label-summary">
        {issue.labels.map((label) => (
          <LabelChip key={label.id} name={label.name} color={label.color} />
        ))}
        <button
          type="button"
          disabled={!options || pending}
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            setSelected(issue.labels.map((label) => label.id));
            setVersion(issue.version);
            setConflict(false);
            setError("");
          }}
        >
          Labels{issue.labels.length ? ` · ${issue.labels.length}` : ""}
        </button>
      </div>
      {open && (
        <form
          aria-label="Apply issue labels"
          onSubmit={save}
          aria-busy={pending}
        >
          <fieldset disabled={pending || !options}>
            <legend>Issue labels · maximum {options?.labelsPerIssue}</legend>
            <div className="issue-label-choices">
              {availableLabels.map((label) => (
                <label key={label.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(label.id)}
                    disabled={
                      !selected.includes(label.id) &&
                      (!options || selected.length >= options.labelsPerIssue)
                    }
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, label.id]
                          : selected.filter((id) => id !== label.id),
                      )
                    }
                  />
                  <LabelChip name={label.name} color={label.color} />
                </label>
              ))}
            </div>
            <div className="issue-editor-actions">
              <button disabled={pending || stale || conflict}>
                {pending ? "Saving labels…" : "Save labels"}
              </button>
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </fieldset>
          {(error || stale) && (
            <p role="alert">
              {error ||
                "This issue changed. Your label choices are kept. Reload labels before saving."}{" "}
              <button
                type="button"
                disabled={pending}
                onClick={() => void reload()}
              >
                Reload labels
              </button>
            </p>
          )}
        </form>
      )}
      {open && options?.canCreateLabels && <form className="issue-label-create" aria-label="Create label inline" onSubmit={create}>
        <fieldset disabled={pending}>
          <legend>Create label</legend>
          <label>New label name<input required maxLength={120} value={labelName} onChange={event => setLabelName(event.target.value)} /></label>
          <label>New label colour<input type="color" value={labelColor} onChange={event => setLabelColor(event.target.value)} /></label>
          <button>Create label</button>
        </fieldset>
      </form>}
    </div>
  );
}
