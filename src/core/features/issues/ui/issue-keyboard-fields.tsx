import type { WorkspaceOptions } from "../../../shared/workspace-options";
import { issueEditChoices, issueEditFields, type IssueEditField, type IssueEditTarget } from "./issue-keyboard-actions";

export function IssueKeyboardFields({ field, rows, options, value, setValue, labels, setLabels, disabled }: {
  field: IssueEditField;
  rows: IssueEditTarget[];
  options: WorkspaceOptions;
  value: string;
  setValue: (value: string) => void;
  labels: string[];
  setLabels: (labels: string[]) => void;
  disabled: boolean;
}) {
  const choices = issueEditChoices(field, rows, options);
  const sameTeam = new Set(rows.map((row) => row.team.id)).size === 1;
  if (field === "labelIds") return (
    <fieldset disabled={disabled}>
      <legend>Replace labels on every target issue</legend>
      {options.labels.map((label, index) => (
        <label key={label.id}>
          <input autoFocus={index === 0} type="checkbox" checked={labels.includes(label.id)}
            onChange={(event) => setLabels(event.target.checked ? [...labels, label.id] : labels.filter((id) => id !== label.id))} />
          {label.name}
        </label>
      ))}
      <small>No labels selected clears labels.</small>
    </fieldset>
  );
  if (field === "estimate" || field === "dueDate" || field === "startDate") return (
    <label>{issueEditFields[field]}
      <input autoFocus aria-label={issueEditFields[field]} type={field === "estimate" ? "number" : "date"}
        min={field === "estimate" ? 1 : undefined} max={field === "estimate" ? 100 : undefined}
        step={field === "estimate" ? 1 : undefined} value={value} disabled={disabled}
        onChange={(event) => setValue(event.target.value)} />
      <small>Leave empty to clear {issueEditFields[field].toLowerCase()} on every target issue.</small>
    </label>
  );
  return (
    <>
      <label>{issueEditFields[field]}
        <select autoFocus aria-label={issueEditFields[field]} value={value} disabled={disabled}
          onChange={(event) => setValue(event.target.value)}>
          <option value="">{field === "assigneeOperatorId" ? "Unassigned" :
            field === "projectId" ? "No project" : field === "milestoneId" ? "No milestone" : field === "cycleId" ? "No cycle" : "Choose value"}</option>
          {value && !choices.some((choice) => choice.id === value) && <option value={value} disabled>Selected value unavailable</option>}
          {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
        </select>
      </label>
      {field === "statusId" && !choices.length && <p role="alert">{!sameTeam
        ? "Status changes require issues from the same team; these issues have no shared workflow status."
        : "There is no status valid for every target issue. Intake and duplicate decisions use their issue detail actions."}</p>}
      {field === "cycleId" && !sameTeam && <p>Choose issues from one team to assign a cycle. You can clear cycles across teams.</p>}
      {field === "milestoneId" && new Set(rows.map(row => row.project?.id ?? null)).size > 1 && <p>Choose issues from one project to assign a milestone. You can clear milestones across projects.</p>}
    </>
  );
}
