import { useEffect, useRef, useId, useState, type FormEvent } from "react";
import { ApiError, fetchJson } from "../../../app/api-client";
import { issueDetailSchema, type IssueDetailData } from "./data";
import { issueListSchema, issueListQuerySchema } from "../list-schema";
import { issueListApiUrl } from "./issue-list-controls";

type ParentBrief = NonNullable<IssueDetailData["parent"]>;
type Pending = "search" | "save" | "refresh" | null;

export function IssueParentPicker({
  issue,
  onCancel,
  onSaved,
  onRefresh,
}: {
  issue: IssueDetailData;
  onCancel: () => void;
  onSaved: (issue: IssueDetailData, parentIdentifier: string | null) => void;
  onRefresh: () => void;
}) {
  const helpId = useId();
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => { searchInput.current?.focus(); }, []);
  const [snapshot, setSnapshot] = useState(() => structuredClone(issue));
  const [receipt, setReceipt] = useState<IssueDetailData | null>(null);
  const current =
    receipt?.identifier === issue.identifier && receipt.version >= issue.version
      ? receipt
      : issue;
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ParentBrief[]>([]);
  const [selectedParent, setSelectedParent] = useState<ParentBrief | null>(null);
  const [moreMatches, setMoreMatches] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [denied, setDenied] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState("");
  const busy = pending !== null;
  const hasStaleVersion = stale || current.version > snapshot.version;

  function clearCorrectableFailure() {
    if (!hasStaleVersion && !denied) setFailure(null);
  }

  function reportFailure(cause: unknown, scope: "search" | "save" | "refresh") {
    const api = cause instanceof ApiError ? cause : null;
    const code = apiErrorCode(api);
    const isStale =
      scope === "save" && api?.status === 409 && code === "stale_version";
    const isDenied = api !== null && [401, 403].includes(api.status);
    const isSelfParent =
      code === "self_parent" ||
      code === "parent_self" ||
      (code === "invalid_option" && /own parent/i.test(api?.message ?? ""));
    const isParentCycle =
      code === "parent_cycle" ||
      code === "parent_ancestry_cycle" ||
      (code === "invalid_option" && /ancestry cycle/i.test(api?.message ?? ""));

    if (isStale) {
      const body = api?.body;
      const issueValue =
        typeof body === "object" && body !== null && "issue" in body
          ? body.issue
          : null;
      const parsed = issueDetailSchema.safeParse(issueValue);
      if (parsed.success) setReceipt(parsed.data);
      setStale(true);
    }
    setDenied(isDenied);
    setFailure(
      isStale
        ? "This issue changed. Your parent choice is kept; refresh the issue before saving again."
        : isSelfParent
          ? "An issue cannot be its own parent."
          : isParentCycle
            ? "This parent would create a cycle."
            : code === "parent_not_found" || code === "issue_not_found"
              ? "That issue is no longer available as a parent. Search again to choose a current issue."
              : isDenied
                ? "Your session cannot perform this action. Sign in again."
                : api?.status === 404
                  ? "The issue could not be found or is unavailable to your session."
                  : cause instanceof Error
                    ? cause.message
                    : scope === "search"
                      ? "The issue search could not be completed."
                      : scope === "refresh"
                        ? "The current issue could not be refreshed."
                        : "The parent could not be saved.",
    );
    if (isDenied) onRefresh();
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || hasStaleVersion || denied) return;
    const term = query.trim();
    if (!term) {
      setSearched(true);
      setMatches([]);
      setMoreMatches(false);
      setFailure("Enter an issue identifier or title to search.");
      return;
    }

    setPending("search");
    setFailure(null);
    setSearched(true);
    setMatches([]);
    setMoreMatches(false);
    try {
      const lists = await Promise.all(
        (["all", "completed"] as const).map((category) => {
          const searchQuery = issueListQuerySchema.parse({
            q: term,
            category,
            offset: 0,
          });
          return fetchJson(issueListApiUrl(searchQuery), issueListSchema);
        }),
      );
      const unique = new Map<string, ParentBrief>();
      for (const row of lists.flatMap((list) => list.issues)) {
        if (row.identifier === current.identifier || unique.has(row.id)) continue;
        unique.set(row.id, {
          id: row.id,
          identifier: row.identifier,
          title: row.title,
          status: row.status,
        });
      }
      const candidates = [...unique.values()];
      setMatches(candidates.slice(0, 12));
      setMoreMatches(
        candidates.length > 12 ||
          lists.some((list) => list.total > list.pageSize),
      );
    } catch (cause) {
      setMatches([]);
      setMoreMatches(false);
      reportFailure(cause, "search");
    } finally {
      setPending(null);
    }
  }

  async function saveParent(parentIdentifier: string | null) {
    if (
      busy ||
      hasStaleVersion ||
      denied ||
      (parentIdentifier !== null && parentIdentifier === snapshot.identifier)
    ) {
      if (parentIdentifier === snapshot.identifier)
        setFailure("An issue cannot be its own parent.");
      return;
    }
    setPending("save");
    setFailure(null);
    setReceiptMessage("");
    try {
      const updated = await fetchJson(
        `/api/issues/${encodeURIComponent(snapshot.identifier)}/parent`,
        issueDetailSchema,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedVersion: snapshot.version,
            parentIdentifier,
          }),
        },
      );
      onSaved(updated, parentIdentifier);
    } catch (cause) {
      reportFailure(cause, "save");
    } finally {
      setPending(null);
    }
  }

  async function refreshIssue() {
    if (busy) return;
    setPending("refresh");
    try {
      const refreshed = await fetchJson(
        `/api/issues/${encodeURIComponent(current.identifier)}`,
        issueDetailSchema,
      );
      setReceipt(refreshed);
      setSnapshot(structuredClone(refreshed));
      setStale(false);
      setDenied(false);
      setFailure(null);
      setReceiptMessage("Issue refreshed. Your parent choice is still selected.");
      onRefresh();
    } catch (cause) {
      reportFailure(cause, "refresh");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="issue-parent__editor">
      <form
        className="issue-parent__search"
        onSubmit={(event) => void search(event)}
      >
        <label>
          Search parent issues
          <input
            ref={searchInput}
            type="search"
            maxLength={200}
            value={query}
            disabled={busy || hasStaleVersion || denied}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearched(false);
              setMatches([]);
              setMoreMatches(false);
              clearCorrectableFailure();
            }}
            placeholder="Identifier or title"
            aria-label="Search parent issues"
            aria-describedby={helpId}
          />
        </label>
        <button
          type="submit"
          disabled={busy || hasStaleVersion || denied}
        >
          {pending === "search" ? "Searching…" : "Search"}
        </button>
      </form>
      <p className="issue-parent__hint" id={helpId}>
        Search returns a bounded set of issues, including completed issues.
      </p>
      {searched && !busy && matches.length === 0 && !failure ? (
        <p role="status">No matching issues. Try another identifier or title.</p>
      ) : null}
      {matches.length ? (
        <ul className="issue-parent__matches" aria-label="Matching parent issues">
          {matches.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                aria-pressed={selectedParent?.id === candidate.id}
                disabled={busy || hasStaleVersion || denied}
                onClick={() => {
                  setSelectedParent(candidate);
                  clearCorrectableFailure();
                  setReceiptMessage("");
                }}
              >
                <strong>{candidate.identifier}</strong>
                <span>{candidate.title}</span>
                <small>{candidate.status.name}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {moreMatches ? (
        <p className="issue-parent__hint">
          Showing a bounded set of matches. Refine the search to find a specific
          issue.
        </p>
      ) : null}
      {selectedParent ? (
        <p className="issue-parent__selected" role="status">
          Selected parent: <strong>{selectedParent.identifier}</strong> ·{" "}
          {selectedParent.title}
        </p>
      ) : null}
      {failure || hasStaleVersion ? (
        <p
          className="issue-parent__message issue-parent__message--error"
          role="alert"
        >
          {failure ??
            "This issue changed. Your parent choice is kept; refresh the issue before saving again."}
          {hasStaleVersion ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void refreshIssue()}
            >
              {pending === "refresh" ? "Refreshing…" : "Refresh issue"}
            </button>
          ) : null}
          {denied ? (
            <a
              href={`/signin?returnTo=${encodeURIComponent(`/app/issues/${current.identifier}`)}`}
            >
              Sign in again
            </a>
          ) : null}
        </p>
      ) : null}
      {receiptMessage ? (
        <p className="issue-parent__message" role="status">
          {receiptMessage}
        </p>
      ) : null}
      <div className="issue-parent__actions">
        <button
          type="button"
          className="decision-submit"
          disabled={
            busy ||
            hasStaleVersion ||
            denied ||
            selectedParent === null ||
            selectedParent.identifier === current.identifier ||
            selectedParent.identifier === current.parent?.identifier
          }
          onClick={() =>
            selectedParent && void saveParent(selectedParent.identifier)
          }
        >
          {pending === "save" ? "Saving…" : "Save parent"}
        </button>
        <button
          type="button"
          disabled={busy || hasStaleVersion || denied || current.parent === null}
          onClick={() => void saveParent(null)}
        >
          Clear parent
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function apiErrorCode(error: ApiError | null): string {
  const body = error?.body;
  if (typeof body !== "object" || body === null || !("error" in body))
    return "";
  return typeof body.error === "string" ? body.error : "";
}
