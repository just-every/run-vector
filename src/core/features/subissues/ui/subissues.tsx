import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { IssueDetailData } from "../../issues/ui/data";
import { useSubissues } from "./use-subissues";
import "./subissues.css";
export function Subissues({
  issue,
  onRefresh,
}: {
  issue: IssueDetailData;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(issue.children.length > 0);
  const completed = issue.children.filter(
    (child) => child.status.category === "completed",
  ).length;
  return (
    <details
      className="issue-subissues"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        Sub-issues{" "}
        <span>
          {completed}/{issue.children.length}
        </span>
      </summary>
      {open && (
        <SubissuePanel issue={issue} onRefresh={onRefresh} />
      )}
    </details>
  );
}
function SubissuePanel({
  issue,
  onRefresh,
}: {
  issue: IssueDetailData;
  onRefresh: () => void;
}) {
  const state = useSubissues(issue.identifier, issue.version, onRefresh),
    [title, setTitle] = useState(""),
    [existing, setExisting] = useState(""),
    [ruleChoice, setRuleChoice] = useState<boolean | null>(null);
  const data = state.data,
    blocked = state.pending || !data || Boolean(state.error);
  function move(index: number, delta: number) {
    if (!data) return;
    const ids = data.children.map((child) => child.identifier);
    [ids[index], ids[index + delta]] = [ids[index + delta]!, ids[index]!];
    void state.reorder(ids);
  }
  return (
    <div className="issue-subissues__panel">
      {state.loading && !data && <p role="status">Loading sub-issues…</p>}
      {state.error && (
        <p role="alert">
          {state.error}{" "}
          <button
            type="button"
            disabled={state.pending}
            onClick={state.refresh}
          >
            Refresh sub-issues
          </button>
        </p>
      )}
      {state.message && <p role="status">{state.message}</p>}
      {data && (
        <>
          <p className="issue-subissues__progress" role="status">
            {data.completed} of {data.total} completed
          </p>
          {data.children.length > 0 && (
            <ol
              className="issue-subissues__list"
              aria-label="Ordered sub-issues"
            >
              {data.children.map((child, index) => (
                <li key={child.id}>
                  <Link
                    className="issue-subissues__link"
                    to="/app/issues/$identifier"
                    params={{ identifier: child.identifier }}
                  >
                    <strong>{child.identifier}</strong>
                    <span>{child.title}</span>
                  </Link>
                  <span className="issue-subissues__status">
                    {child.status.name}
                  </span>
                  <span className="issue-subissues__assignee">
                    {child.assignee?.name ?? "Unassigned"}
                  </span>
                  <div className="issue-subissues__actions">
                    <button
                      type="button"
                      disabled={blocked || index === 0}
                      aria-label={`Move ${child.identifier} up`}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={blocked || index === data.children.length - 1}
                      aria-label={`Move ${child.identifier} down`}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => void state.convert(child)}
                      aria-label={`Convert ${child.identifier} to a root issue`}
                    >
                      Make root
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void state.create(title).then((saved) => {
                if (saved) setTitle("");
              });
            }}
          >
            <label>
              New sub-issue title
              <input
                required
                maxLength={500}
                value={title}
                disabled={state.pending}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <button type="submit" disabled={blocked || !title.trim()}>
              Create sub-issue
            </button>
          </form>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void state
                .addExisting(existing.trim().toUpperCase())
                .then((saved) => {
                  if (saved) setExisting("");
                });
            }}
          >
            <label>
              Existing issue identifier
              <input
                required
                pattern="[A-Za-z]{2,10}-[1-9][0-9]*"
                maxLength={30}
                placeholder="TEAM-123"
                value={existing}
                disabled={state.pending}
                onChange={(event) => setExisting(event.target.value)}
              />
            </label>
            <button type="submit" disabled={blocked || !existing.trim()}>
              Add existing issue
            </button>
          </form>
          <label className="issue-subissues__rule">
            <input
              type="checkbox"
              checked={ruleChoice ?? data.rule.enabled}
              disabled={blocked}
              onChange={(event) => {
                const enabled = event.target.checked;
                setRuleChoice(enabled);
                void state.setRule(enabled).then(() => setRuleChoice(null));
              }}
            />
            Complete and reopen parents automatically for this team
          </label>
          <p className="issue-subissues__hint">
            All sub-issues must be Completed. Any unfinished sub-issue reopens a
            completed parent. Canceled, Duplicate and Intake parents keep their
            status.
          </p>
        </>
      )}
    </div>
  );
}
