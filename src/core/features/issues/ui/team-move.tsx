import { useState, type FormEvent } from "react";
import { ApiError, fetchJson } from "../../../app/api-client";
import type { StreamOptions } from "../../streams/ui/data";
import { issueDetailSchema, type IssueDetailData } from "./data";
import "./team-move.css";

type Choice = { id: string; name: string };
type TeamMoveProps = {
  issue: IssueDetailData;
  options: StreamOptions | null;
  optionsError: Error | null;
  onRefresh: () => void;
};

export function TeamMove({
  issue,
  options,
  optionsError,
  onRefresh,
}: TeamMoveProps) {
  const [snapshot, setSnapshot] = useState<IssueDetailData | null>(null);
  const [team, setTeam] = useState<Choice | null>(null);
  const [status, setStatus] = useState<Choice | null>(null);
  const [pending, setPending] = useState<"move" | "reload" | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [receipt, setReceipt] = useState<{ message: string; version: number } | null>(null);
  const busy = pending !== null;
  const stale = snapshot !== null && issue.version > snapshot.version;
  const teams =
    options?.teams.filter((choice) => choice.id !== snapshot?.team.id) ?? [];
  const statuses =
    options?.statuses.filter(
      (choice) =>
        choice.teamId === team?.id &&
        choice.category === snapshot?.status.category,
    ) ?? [];
  const teamUnavailable =
    team !== null && !teams.some((choice) => choice.id === team.id);
  const statusUnavailable =
    status !== null && !statuses.some((choice) => choice.id === status.id);

  function clearDraft() {
    setSnapshot(null);
    setTeam(null);
    setStatus(null);
    setError("");
    setDenied(false);
    setConflict(false);
  }

  function openDraft() {
    setSnapshot(structuredClone(issue));
    setTeam(null);
    setStatus(null);
    setError("");
    setDenied(false);
    setConflict(false);
    setReceipt(null);
  }

  function reportFailure(cause: unknown) {
    const needsSignIn = cause instanceof ApiError && cause.status === 401;
    const isConflict = cause instanceof ApiError && cause.status === 409;
    setDenied(needsSignIn);
    setConflict(isConflict);
    setError(
      needsSignIn
        ? "Your session ended. Sign in again to move this issue."
        : isConflict
          ? "This issue changed. Your choices were kept. Reload issue before moving it."
          : cause instanceof Error
            ? cause.message
            : "The team move could not be saved.",
    );
  }

  async function reloadCurrent() {
    if (!snapshot || busy) return;
    setPending("reload");
    setError("");
    try {
      const current = await fetchJson(
        `/api/issues/${encodeURIComponent(snapshot.identifier)}`,
        issueDetailSchema,
      );
      // Only this explicit action replaces the move snapshot and choices.
      setSnapshot(structuredClone(current));
      setTeam(null);
      setStatus(null);
      setConflict(false);
      setDenied(false);
      onRefresh();
    } catch (cause) {
      reportFailure(cause);
    } finally {
      setPending(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !team || !status || busy) return;
    setPending("move");
    setError("");
    try {
      const updated = await fetchJson(
        `/api/issues/${encodeURIComponent(snapshot.identifier)}/team`,
        issueDetailSchema,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: snapshot.version,
            teamId: team.id,
            statusId: status.id,
          }),
        },
      );
      setReceipt({ message: `Moved to ${team.name}.`, version: updated.version });
      clearDraft();
      onRefresh();
    } catch (cause) {
      reportFailure(cause);
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="detail-section team-move">
      <details
        open={snapshot !== null}
        onToggle={(event) => {
          if (busy && snapshot && !event.currentTarget.open)
            event.currentTarget.open = true;
          else if (!busy && snapshot && !event.currentTarget.open) clearDraft();
        }}
      >
        <summary
          aria-disabled={busy || undefined}
          onClick={(event) => {
            event.preventDefault();
            if (busy) return;
            if (snapshot) clearDraft();
            else openDraft();
          }}
        >
          Move team
        </summary>
        {snapshot ? (
          <form className="issue-mutation-form" onSubmit={submit}>
            <fieldset
              className="team-move-controls"
              disabled={busy}
              aria-label="Team move fields"
            >
              <p className="team-move-context">
                {snapshot.team.name} · {snapshot.status.name}. Identifier stays{" "}
                {snapshot.identifier}.
              </p>
              {snapshot.cycle ? (
                <p className="team-move-warning">
                  Moving removes the {snapshot.cycle.name} cycle commitment.
                </p>
              ) : null}
              {optionsError ? (
                <p role="alert">
                  Team and status choices could not be refreshed:{" "}
                  {optionsError.message}
                </p>
              ) : null}
              <div className="detail-section--two">
                <label>
                  Target team
                  <select
                    required
                    value={team?.id ?? ""}
                    onChange={(event) => {
                      setTeam(
                        teams.find(
                          (choice) => choice.id === event.target.value,
                        ) ?? null,
                      );
                      setStatus(null);
                    }}
                    disabled={!options}
                  >
                    <option value="">Choose a team</option>
                    {teamUnavailable ? (
                      <option value={team.id}>{team.name} (unavailable)</option>
                    ) : null}
                    {teams.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Target status
                  <select
                    required
                    value={status?.id ?? ""}
                    onChange={(event) =>
                      setStatus(
                        statuses.find(
                          (choice) => choice.id === event.target.value,
                        ) ?? null,
                      )
                    }
                    disabled={!options || !team}
                  >
                    <option value="">Choose a target status</option>
                    {statusUnavailable ? (
                      <option value={status.id}>
                        {status.name} (unavailable)
                      </option>
                    ) : null}
                    {statuses.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {options && teams.length === 0 ? (
                <p>No other available teams.</p>
              ) : null}
              {team && options && statuses.length === 0 ? (
                <p>
                  This team has no available status in the same category. Choose
                  another team.
                </p>
              ) : null}
              <div className="team-move-actions">
                <button
                  type="submit"
                  className="decision-submit"
                  disabled={busy || !options || !team || !status || denied}
                >
                  {pending === "move" ? "Moving…" : "Move issue"}
                </button>
                <button type="button" onClick={clearDraft} disabled={busy}>
                  Cancel
                </button>
              </div>
              {error || stale || conflict ? (
                <p role="alert">
                  {error ||
                    "This issue changed. Your move choices were kept. Reload before moving it."}{" "}
                  <button
                    type="button"
                    onClick={() => void reloadCurrent()}
                    disabled={busy}
                  >
                    {pending === "reload" ? "Reloading…" : "Reload issue"}
                  </button>
                  {denied ? (
                    <>
                      {" "}
                      <a
                        href={`/signin?returnTo=${encodeURIComponent(`/app/issues/${snapshot.identifier}`)}`}
                      >
                        Sign in again
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </fieldset>
          </form>
        ) : null}
      </details>
      {receipt?.version === issue.version ? <p role="status">{receipt.message}</p> : null}
    </section>
  );
}
