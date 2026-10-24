import { useState } from "react";
import { fetchJson } from "../../app/api-client";
import { issueDetailSchema, type IssueDetailData } from "../issues/ui/data";
export function IssueDuplicates({
  issue,
  onRefresh,
  writable = true,
}: {
  writable?: boolean;
  issue: IssueDetailData;
  onRefresh: () => void;
}) {
  const [target, setTarget] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function decide(canonicalIdentifier: string | null) {
    setBusy(true);
    setError("");
    try {
      await fetchJson(
        `/api/issues/${issue.identifier}/duplicate`,
        issueDetailSchema,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: issue.version,
            canonicalIdentifier,
          }),
        },
      );
      setTarget("");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision could not complete.");
      onRefresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="secondary-section">
      <summary>
        Duplicates · {issue.duplicates.length}
        {issue.canonical ? " · " + issue.canonical.identifier : ""}
      </summary>
      {issue.canonical ? (
        <p>
          Duplicate of{" "}
          <a href={`/app/issues/${issue.canonical.identifier}`}>
            {issue.canonical.identifier} · {issue.canonical.title}
          </a>{" "}
          <button type="button" disabled={!writable || busy} onClick={() => decide(null)}>
            Undo duplicate
          </button>
        </p>
      ) : null}
      {issue.duplicates.length > 0 && (
        <ul>
          {issue.duplicates.map((row) => (
            <li key={row.identifier}>
              <a href={`/app/issues/${row.identifier}`}>
                {row.identifier} · {row.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      {writable && <form
        onSubmit={(event) => {
          event.preventDefault();
          void decide(target.trim().toUpperCase());
        }}
      >
        <label>
          Canonical issue identifier{" "}
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="FLW-123"
            required
            pattern="[A-Za-z]{2,10}-[1-9][0-9]*"
            disabled={!writable || busy}
          />
        </label>{" "}
        <button type="submit" disabled={!writable || busy}>
          Mark duplicate
        </button>
      </form>}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
