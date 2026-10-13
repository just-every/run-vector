import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useApiResource } from "../../../app/api-client";
import { issueListSchema } from "../../issues/list-schema";
import {
  eligibleCommitmentIssues,
  commitmentSearchUrl,
} from "./commitment-choices";

export function CommitIssueForm({
  teamId,
  teamArchived,
  pending,
  commit,
}: {
  teamId: string;
  teamArchived: boolean;
  pending: boolean;
  commit: (identifier: string) => Promise<void>;
}) {
  const [identifier, setIdentifier] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const helpId = useId();
  const candidates = useApiResource(
    commitmentSearchUrl(identifier),
    issueListSchema,
  );
  const issues = eligibleCommitmentIssues(
    candidates.data?.issues ?? [],
    teamId,
    teamArchived,
  );
  const expanded =
    open &&
    !pending &&
    !teamArchived &&
    !candidates.loading &&
    !candidates.error &&
    issues.length > 0;
  const active = Math.min(selected, issues.length - 1);
  useEffect(() => {
    if (expanded && active >= 0)
      list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [expanded, active]);
  function choose(index: number) {
    const issue = issues[index];
    if (!expanded || !issue) return;
    setIdentifier(issue.identifier);
    setSelected(-1);
    input.current?.focus();
    setOpen(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || teamArchived) return;
    await commit(identifier.trim());
    candidates.reload();
  }
  return (
    <form
      className="commit-issue-form"
      aria-label="Commit issue to cycle"
      onSubmit={submit}
    >
      <fieldset disabled={pending || teamArchived}>
        <label>
          Issue identifier
          <input
            name="identifier"
            ref={input}
            required
            placeholder="Search by identifier or title"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={expanded ? listId : undefined}
            aria-activedescendant={
              expanded && active >= 0 ? `${listId}-${active}` : undefined
            }
            value={identifier}
            maxLength={200}
            aria-describedby={helpId}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setSelected(-1);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Escape" || event.key === "Tab") {
                setOpen(false);
                setSelected(-1);
                if (event.key === "Escape") event.preventDefault();
              }
              if (
                !pending &&
                !teamArchived &&
                !candidates.loading &&
                !candidates.error &&
                issues.length &&
                ["ArrowDown", "ArrowUp"].includes(event.key)
              ) {
                event.preventDefault();
                setOpen(true);
                setSelected(
                  active < 0
                    ? event.key === "ArrowDown"
                      ? 0
                      : issues.length - 1
                    : (active +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        issues.length) %
                        issues.length,
                );
              }
              if (expanded && active >= 0 && event.key === "Enter") {
                event.preventDefault();
                choose(active);
              }
            }}
          />
        </label>
        {expanded && (
          <div
            className="commit-issue-choices"
            ref={list}
            id={listId}
            role="listbox"
            aria-label="Eligible cycle issues"
          >
            {issues.map((issue, index) => (
              <button
                key={issue.id}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === active}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setSelected(index)}
                onClick={() => choose(index)}
              >
                <strong>{issue.identifier}</strong> <span>{issue.title}</span>
              </button>
            ))}
          </div>
        )}
        <p id={helpId}>
          {teamArchived
            ? "This team is archived. Unarchive it in Settings before committing work."
            : "Choose an issue from this team, or type its identifier. Use ↑ ↓ to choose and Enter to select. Completed, canceled and duplicate issues cannot be committed."}
        </p>
        {candidates.loading && <p role="status">Finding issues…</p>}
        {candidates.error && (
          <p role="alert">
            {candidates.error.message}{" "}
            <button type="button" onClick={candidates.reload}>
              Retry issue choices
            </button>
          </p>
        )}
        {candidates.data && !candidates.loading && !candidates.error && (
          <p>
            {issues.length
              ? `${issues.length} eligible issue${issues.length === 1 ? "" : "s"} in these results.`
              : "No eligible issues in these results."}{" "}
            {candidates.data.total > candidates.data.pageSize &&
              "Showing up to 50 search results. Type more of the identifier or title to narrow the choices."}
          </p>
        )}
        <button>Commit issue</button>
      </fieldset>
    </form>
  );
}
