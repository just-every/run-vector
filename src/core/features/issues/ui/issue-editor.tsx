import { MentionTextarea } from "../../notifications/ui/mention-textarea";
import { useRef, useState } from "react";
import "./issue-editor.css";
import { ApiError, fetchJson } from "../../../app/api-client";
import { issueDetailSchema, type IssueDetailData } from "./data";
export function IssueEditor({
  issue,
  onRefresh,
}: {
  issue: IssueDetailData;
  onRefresh: () => void;
}) {
  // Scope every draft, receipt and error to one issue, including callers that
  // keep this component mounted while changing their issue selection.
  return (
    <IssueWritingEditor
      key={issue.identifier}
      issue={issue}
      onRefresh={onRefresh}
    />
  );
}

function IssueWritingEditor({
  issue,
  onRefresh,
}: {
  issue: IssueDetailData;
  onRefresh: () => void;
}) {
  const [snapshot, setSnapshot] = useState<{
      issue: IssueDetailData;
      revision: number;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [receipt, setReceipt] = useState<IssueDetailData | null>(null);
  const current =
    receipt?.identifier === issue.identifier && receipt.version > issue.version
      ? receipt
      : issue;
  const latestCurrent = useRef(current);
  latestCurrent.current = current;
  const editing = snapshot?.issue;
  const stale = editing ? current.version > editing.version : false;

  async function reloadCurrent() {
    if (!snapshot || busy) return;
    setBusy(true);
    setError("");
    try {
      const loaded = await fetchJson(
        `/api/issues/${snapshot.issue.identifier}`,
        issueDetailSchema,
      );
      if (loaded.identifier !== snapshot.issue.identifier)
        throw new Error("The reload returned a different issue.");
      const refreshed =
        latestCurrent.current.version > loaded.version
          ? latestCurrent.current
          : loaded;
      setReceipt(refreshed);
      // Replace defaults only after the operator explicitly reloads and the
      // current record passes validation. A failed reload preserves their draft.
      setSnapshot({
        issue: structuredClone(refreshed),
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
    const body = {
      expectedVersion: editing.version,
      title: form.get("title"),
      description:
        event.currentTarget.querySelector<HTMLTextAreaElement>(
          'textarea[name="description"]',
        )?.dataset.canonicalBody ?? form.get("description"),
    };
    try {
      const updated = await fetchJson(
        `/api/issues/${editing.identifier}`,
        issueDetailSchema,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (updated.identifier !== editing.identifier)
        throw new Error("The save returned a different issue.");
      setReceipt((previous) =>
        previous && previous.version > updated.version ? previous : updated,
      );
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
    <section className={`issue-writing-editor${snapshot ? " is-editing" : ""}`}>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setSnapshot(
            snapshot ? null : { issue: structuredClone(current), revision: 0 },
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
        >
          <fieldset
            className="issue-editor-controls"
            disabled={busy}
            aria-label="Issue edit fields"
          >
            <IssueEditFields issue={editing} />
            <button type="submit" disabled={busy}>
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

function IssueEditFields({ issue }: { issue: IssueDetailData }) {
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
        <MentionTextarea
          aria-label="Description"
          name="description"
          maxLength={100_000}
          defaultValue={issue.description}
        />
      </label>
    </>
  );
}
