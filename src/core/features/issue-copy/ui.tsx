import { useState } from "react";
import { z } from "zod";
import { fetchJson, useApiResource, ApiError } from "../../app/api-client";
import { issueDetailSchema } from "../issues/ui/data";
import { optionsSchema } from "../streams/ui/data";
import { IssueKeyboardModal } from "../issues/ui/issue-keyboard-modal";
import "../issues/ui/issue-keyboard.css";

const receiptSchema = z.object({
  issue: issueDetailSchema,
  copies: z.array(
    z.object({ fromIdentifier: z.string(), identifier: z.string() }),
  ),
  droppedValues: z.array(
    z.object({
      identifier: z.string(),
      field: z.string(),
      value: z.unknown(),
      reason: z.string(),
    }),
  ),
});
export function IssueCopyAction({
  identifier,
  onRefresh,
}: {
  identifier: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <details className="issue-copy-menu">
        <summary>Issue menu</summary>
        <button
          type="button"
          onClick={(event) => {
            event.currentTarget.closest("details")?.removeAttribute("open");
            setOpen(true);
          }}
        >
          Copy issue…
        </button>
      </details>
      {open && (
        <IssueCopyDialog
          identifier={identifier}
          onClose={() => setOpen(false)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
export function IssueCopyDialog({
  identifier,
  onClose,
  onRefresh,
}: {
  identifier: string;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const source = useApiResource(`/api/issues/${identifier}`, issueDetailSchema);
  const options = useApiResource("/api/options", optionsSchema);
  const [teamId, setTeamId] = useState("");
  const [includeSubissues, setSubissues] = useState(false),
    [includeLinks, setLinks] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [receipt, setReceipt] = useState<z.infer<typeof receiptSchema> | null>(
    null,
  );
  const targetTeam = teamId || source.data?.team.id || "";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!source.data || busy || conflict) return;
    setBusy(true);
    setError("");
    try {
      const result = await fetchJson(
        `/api/issues/${identifier}/copy`,
        receiptSchema,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: source.data.version,
            teamId: targetTeam,
            includeSubissues,
            includeLinks,
          }),
        },
      );
      setReceipt(result);
      onRefresh?.();
      window.dispatchEvent(new Event("vector:issues-changed"));
    } catch (cause) {
      setConflict(cause instanceof ApiError && cause.status === 409);
      setError(
        cause instanceof Error ? cause.message : "Copy could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <IssueKeyboardModal
      title={`Copy issue ${identifier}`}
      busy={busy}
      onClose={onClose}
    >
      {receipt ? (
        <div role="status">
          <p>
            Created{" "}
            <a href={`/app/issues/${receipt.issue.identifier}`}>
              {receipt.issue.identifier} · {receipt.issue.title}
            </a>{" "}
            in Backlog.
          </p>
          {receipt.copies.length > 1 && (
            <p>{receipt.copies.length - 1} sub-issues copied.</p>
          )}
          {receipt.droppedValues.length ? (
            <>
              <p>Values omitted from the copy:</p>
              <ul>
                {receipt.droppedValues.map((drop, index) => (
                  <li key={index}>
                    {drop.identifier} · {drop.field}: {String(drop.value)}.{" "}
                    {drop.reason}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>All selected field values were preserved.</p>
          )}
        </div>
      ) : (
        <form
          className="issue-mutation-form"
          onSubmit={(event) => void submit(event)}
        >
          <p>
            The copy starts in the destination team’s default Backlog status.
            Comments, history, attachments, followers and customer requests are
            excluded.
          </p>
          {source.error && <p role="alert">{source.error.message}</p>}
          {options.error && <p role="alert">{options.error.message}</p>}
          <fieldset disabled={busy || !source.data || !options.data}>
            <label>
              Destination team
              <select
                required
                value={targetTeam}
                onChange={(event) => setTeamId(event.target.value)}
              >
                {options.data?.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            {source.data && targetTeam !== source.data.team.id && (
              <p>
                Statuses map to the destination’s Backlog. Workspace labels and
                custom fields are preserved. Cycle commitments are omitted and
                reported after copying.
              </p>
            )}
            <label>
              <input
                type="checkbox"
                checked={includeSubissues}
                onChange={(event) => setSubissues(event.target.checked)}
              />
              Include sub-issues
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeLinks}
                onChange={(event) => setLinks(event.target.checked)}
              />
              Include issue links
            </label>
            {source.data?.cycle && (
              <p>
                Source cycle: {source.data.cycle.name}. Preserved when copying
                within this team.
              </p>
            )}
            <button
              className="decision-submit"
              type="submit"
              disabled={busy || conflict}
            >
              {busy ? "Copying…" : "Copy issue"}
            </button>
          </fieldset>
          {error && <p role="alert">{error}</p>}
          {(conflict || source.error || options.error) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                source.reload();
                options.reload();
                setConflict(false);
                setError("");
              }}
            >
              Reload issue and choices
            </button>
          )}
        </form>
      )}
    </IssueKeyboardModal>
  );
}
