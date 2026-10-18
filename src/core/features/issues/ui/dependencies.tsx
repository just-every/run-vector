import { Link } from "@tanstack/react-router";
import { useId, useState, type FormEvent } from "react";
import { z } from "zod";
import { ApiError, fetchJson } from "../../../app/api-client";
import { issueDetailSchema, type IssueDetailData } from "./data";
import "./dependency-editor.css";

type Direction = "blocks" | "blocked-by" | "related";
type Failure = {
  message: string;
  denied: boolean;
  needsReload: boolean;
  scope: "add" | "remove" | "reload";
};
const mutationSchema = z.object({
  issue: issueDetailSchema,
  relatedIssue: issueDetailSchema,
});
const identifierPattern = /^[A-Z]{2,10}-[1-9][0-9]*$/;

export function Dependencies({
  issue,
  onRefresh,
}: {
  issue: IssueDetailData;
  onRefresh: () => void;
}) {
  const headingId = useId();
  const [snapshot, setSnapshot] = useState<IssueDetailData | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [direction, setDirection] = useState<Direction | "">("");
  const [readReceipt, setReadReceipt] = useState<IssueDetailData | null>(null);
  const [pending, setPending] = useState<"add" | "remove" | "reload" | null>(
    null,
  );
  const [failure, setFailure] = useState<Failure | null>(null);
  const [receipt, setReceipt] = useState("");
  const busy = pending !== null;
  // A validated mutation/reload receipt can arrive before the parent's refresh.
  // It updates this list without replacing either the add or core-editor draft.
  const current =
    readReceipt?.identifier === issue.identifier &&
    readReceipt.version > issue.version
      ? readReceipt
      : issue;
  const stale = snapshot !== null && current.version > snapshot.version;
  const blocked = failure?.denied || failure?.needsReload;

  function clearAdd() {
    setSnapshot(null);
    setIdentifier("");
    setDirection("");
    setFailure((existing) =>
      existing?.scope !== "remove" && !existing?.denied ? null : existing,
    );
  }

  function openAdd() {
    setSnapshot(structuredClone(current));
    setIdentifier("");
    setDirection("");
    setReceipt("");
  }

  function clearCorrectableFailure() {
    setFailure((existing) =>
      existing?.scope === "add" && !existing.denied && !existing.needsReload
        ? null
        : existing,
    );
  }

  function reportFailure(cause: unknown, scope: Failure["scope"]) {
    const api = cause instanceof ApiError ? cause : null;
    const code =
      api &&
      typeof api.body === "object" &&
      api.body !== null &&
      "error" in api.body
        ? String(api.body.error)
        : "";
    const denied = api !== null && [401, 403].includes(api.status);
    const needsReload =
      code === "stale_version" || code === "dependency_not_found" || code === "related_not_found";
    const graphMessages: Record<string, string> = {
      related_exists: "These issues are already related.",
      related_not_found: "This related link no longer exists. Reload the issue.",
      self_dependency: "An issue cannot depend on itself.",
      dependency_exists:
        "These issues already have a dependency in one direction.",
      dependency_cycle: "This dependency would create a cycle.",
      dependency_not_found:
        "This dependency no longer exists. Reload the issue to review its current dependencies.",
    };
    setFailure((existing) => ({
      scope,
      denied: denied || existing?.denied === true,
      needsReload: needsReload || existing?.needsReload === true,
      message: denied
        ? "Your session cannot perform this action. Sign in again."
        : code === "stale_version"
          ? "One of these issues changed. Your dependency choices were kept. Reload before trying again."
          : (graphMessages[code] ??
            (api?.status === 404
              ? "The issue could not be found or is unavailable to your session."
              : cause instanceof Error
                ? cause.message
                : "The dependency could not be saved.")),
    }));
    // The parent's native resource gate clears private issue/stream content
    // after its authorized read confirms the session is no longer available.
    if (denied) onRefresh();
  }

  async function reloadCurrent() {
    if (busy) return;
    setPending("reload");
    try {
      const loaded = await fetchJson(
        `/api/issues/${encodeURIComponent(current.identifier)}`,
        issueDetailSchema,
      );
      setReadReceipt(loaded);
      if (snapshot) setSnapshot(structuredClone(loaded));
      // Keep the identifier/direction draft; the next submit resolves its related
      // version through a new authorized read rather than reusing a cached one.
      setFailure(null);
      onRefresh();
    } catch (cause) {
      reportFailure(cause, "reload");
    } finally {
      setPending(null);
    }
  }

  async function write(
    method: "POST" | "DELETE",
    source: IssueDetailData,
    relatedIdentifier: string,
    relationship: Direction,
  ) {
    if (busy || blocked) return;
    setPending(method === "POST" ? "add" : "remove");
    setFailure(null);
    setReceipt("");
    try {
      const related = await fetchJson(
        `/api/issues/${encodeURIComponent(relatedIdentifier)}`,
        issueDetailSchema,
      );
      const result = await fetchJson(
        `/api/issues/${encodeURIComponent(source.identifier)}/dependencies`,
        mutationSchema,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: source.version,
            relatedIdentifier: related.identifier,
            relatedVersion: related.version,
            direction: relationship,
          }),
        },
      );
      setReadReceipt(result.issue);
      const kind =
        method === "POST"
          ? (relationship === "related" ? "issue.related_added" : "issue.dependency_added")
          : (relationship === "related" ? "issue.related_removed" : "issue.dependency_removed");
      const oldIds = new Set(source.activity.map((activity) => activity.id));
      const activity = result.issue.activity.find(
        (entry) => entry.kind === kind && !oldIds.has(entry.id),
      );
      const relation = relationship === "related" ? "is related to" : relationship === "blocks" ? "blocks" : "is blocked by";
      setReceipt(
        `${method === "POST" ? "Added" : "Removed"} ${relationship === "related" ? "related link" : "dependency"}: ${source.identifier} ${relation} ${related.identifier}${activity?.actor ? ` · ${activity.actor}` : " · actor recorded in History"}.`,
      );
      if (method === "POST") clearAdd();
      onRefresh();
    } catch (cause) {
      reportFailure(cause, method === "POST" ? "add" : "remove");
    } finally {
      setPending(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !direction || busy || blocked) return;
    const related = identifier.trim().toUpperCase();
    if (!identifierPattern.test(related)) {
      reportFailure(
        new Error("Enter an issue identifier such as FLW-123."),
        "add",
      );
      return;
    }
    if (related === snapshot.identifier) {
      reportFailure(new Error("An issue cannot depend on itself."), "add");
      return;
    }
    void write("POST", snapshot, related, direction);
  }

  return (
    <section
      className="detail-section dependency-editor"
      aria-labelledby={headingId}
    >
      <h2
        id={headingId}
        className={
          current.dependencies.length === 0 ? "visually-hidden" : undefined
        }
      >
        Relationships
      </h2>
      {current.dependencies.length > 0 ? (
        <ul className="dependency-list">
          {current.dependencies.map((dependency) => (
            <li key={`${dependency.direction}-${dependency.identifier}`}>
              <span>
                {dependency.direction === "blocked-by"
                  ? "Blocked by"
                  : dependency.direction === "blocks"
                    ? "Blocks"
                    : dependency.direction === "related" ? "Related" : dependency.direction}
              </span>
              <Link
                to="/app/issues/$identifier"
                params={{ identifier: dependency.identifier }}
                aria-disabled={busy || undefined}
                onClick={(event) => {
                  if (busy) event.preventDefault();
                }}
              >
                <strong>{dependency.identifier}</strong> {dependency.title}
              </Link>
              <button
                type="button"
                disabled={busy || blocked}
                aria-label={`Remove ${dependency.direction === "related" ? "related link" : "dependency"} ${dependency.identifier}`}
                onClick={() => {
                  if (
                    dependency.direction !== "blocks" &&
                    dependency.direction !== "blocked-by" &&
                    dependency.direction !== "related"
                  ) {
                    reportFailure(
                      new Error(
                        "This dependency has an unavailable direction. Reload the issue.",
                      ),
                      "remove",
                    );
                    return;
                  }
                  void write(
                    "DELETE",
                    current,
                    dependency.identifier,
                    dependency.direction,
                  );
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <details
        open={snapshot !== null}
        onToggle={(event) => {
          if (busy && snapshot && !event.currentTarget.open)
            event.currentTarget.open = true;
          else if (!busy && snapshot && !event.currentTarget.open) clearAdd();
        }}
      >
        <summary
          aria-disabled={busy || undefined}
          onClick={(event) => {
            event.preventDefault();
            if (busy) return;
            if (snapshot) clearAdd();
            else openAdd();
          }}
        >
          Add dependency
        </summary>
        {snapshot ? (
          <form className="issue-mutation-form" onSubmit={submit}>
            <fieldset
              className="dependency-controls"
              disabled={busy}
              aria-label="Dependency fields"
            >
              <div className="detail-section--two">
                <label>
                  Issue identifier
                  <input
                    required
                    maxLength={64}
                    placeholder="FLW-123"
                    value={identifier}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      clearCorrectableFailure();
                    }}
                  />
                </label>
                <label>
                  Direction
                  <select
                    required
                    value={direction}
                    onChange={(event) => {
                      setDirection(event.target.value as Direction | "");
                      clearCorrectableFailure();
                    }}
                  >
                    <option value="">Choose a relationship</option>
                    <option value="related">Related, without blocking</option>
                    <option value="blocks">
                      This issue blocks the other issue
                    </option>
                    <option value="blocked-by">
                      This issue is blocked by the other issue
                    </option>
                  </select>
                </label>
              </div>
              <div className="dependency-actions">
                <button
                  type="submit"
                  className="decision-submit"
                  disabled={busy || blocked}
                >
                  {pending === "add" ? "Adding…" : "Add dependency"}
                </button>
                <button type="button" disabled={busy} onClick={clearAdd}>
                  Cancel
                </button>
              </div>
            </fieldset>
          </form>
        ) : null}
      </details>
      {failure || stale ? (
        <p role="alert">
          {failure?.message ??
            "This issue changed. Your dependency choices were kept. Reload before adding it."}{" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => void reloadCurrent()}
          >
            {pending === "reload" ? "Reloading…" : "Reload issue"}
          </button>
          {failure && !snapshot && !failure.denied ? (
            <>
              {" "}
              <button
                type="button"
                disabled={busy}
                onClick={() => setFailure(null)}
              >
                Cancel
              </button>
            </>
          ) : null}
          {failure?.denied ? (
            <>
              {" "}
              <a
                href={`/signin?returnTo=${encodeURIComponent(`/app/issues/${current.identifier}`)}`}
              >
                Sign in again
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {receipt ? <p role="status">{receipt}</p> : null}
    </section>
  );
}
