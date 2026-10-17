import { MentionTextarea } from "../../notifications/ui/mention-textarea";
import { useRef, useState } from "react";
import { z } from "zod";
import { useApiResource } from "../../../app/api-client";
import { useHydrated } from '../../../app/initial-resources';
import { NamedLinks } from "../../links/ui/named-links";
import { discussionSchema } from "../../discussion/schema";
import { CommentThread, commentThreads } from "./discussion-thread";


export { CommentTimestamp } from "./discussion-thread";

export function Discussion({
  identifier,
  onRefresh,
}: {
  identifier: string;
  onRefresh: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();
  const resource = useApiResource(
      `/api/issues/${identifier}/discussion`,
      discussionSchema,
      undefined,
      { abortPendingOnDispose: false },
    ),
    [filesOpen, setFilesOpen] = useState(false),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function mutate(
    path: string,
    init: RequestInit,
    onSuccess?: () => void,
  ) {
    setBusy(true);
    setError("");
    try {
      const comment = (path === "comments" || /^comments\/[^/]+\/checklist$/.test(path)) && init.method === "POST";
      const headers = new Headers(init.headers);
      if (comment) headers.set("x-vector-projection", "discussion");
      const response = await fetch(`/api/issues/${identifier}/${path}`, { ...init, headers });
      if (!response.ok) {
        const data = z
          .object({ message: z.string().optional() })
          .parse(await response.json());
        throw new Error(data.message ?? `Action failed (${response.status}).`);
      }
      if (comment) {
        const receipt = z.object({ discussion: discussionSchema }).parse(await response.json());
        resource.publishReceipt(() => receipt.discussion);
      } else {
        await response.arrayBuffer();
        resource.refreshAfterMutation();
      }
      onSuccess?.();
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
      resource.reload();
    } finally {
      setBusy(false);
    }
  }
  const json = (method: string, body: unknown) => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (
    <section className="detail-section">
      <h2>Discussion</h2>
      {resource.error ? (
        <p role="alert">
          {resource.error.message}
          <button onClick={resource.reload}>Retry discussion</button>
        </p>
      ) : null}
      {resource.data
        ? commentThreads(resource.data.comments).map(({ root, replies }) => (
            <CommentThread
              key={root.id}
              root={root}
              replies={replies}
              identifier={identifier}
              data={resource.data!}
              busy={busy}
              mutate={mutate}
              onLinksChanged={() => {
                resource.refreshAfterMutation();
                onRefresh();
              }}
            />
          ))
        : null}
      <form
        className="issue-mutation-form comment-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void mutate("comments", json("POST", { body }), () => setBody(""));
        }}
      >
        <label>
          <span className="visually-hidden">Add a comment</span>
          <MentionTextarea
            aria-label="Add a comment"
            placeholder="Write a comment…"
            required
            maxLength={100000}
            disabled={busy || !hydrated}
            value={body}
            onValueChange={setBody}
          />
        </label>
        <button disabled={busy || !hydrated} type="submit">
          Add comment
        </button>
      </form>
      <NamedLinks
        identifier={identifier}
        links={resource.data?.links ?? []}
        onRefresh={() => {
          resource.refreshAfterMutation();
          onRefresh();
        }}
      />
      <details
        className="issue-files"
        open={filesOpen}
        onToggle={(event) => setFilesOpen(event.currentTarget.open)}
      >
        <summary>Files · {resource.data?.files.length ?? 0}</summary>
        {resource.data?.files.map((f) => (
          <div className="file-entry" key={f.id}>
            {f.state === "ready" && !f.removalPending ? (
              <a href={`/api/issues/${identifier}/files/${f.id}`} download={f.name}>{f.name}</a>
            ) : (
              <span>
                {f.name} ·{" "}
                {f.removalPending
                  ? f.cleanupError
                    ? "Removal needs retry"
                    : "Removal pending"
                  : f.state === "failed"
                    ? "Upload failed"
                    : "Upload incomplete"}
              </span>
            )}
            <span>{Math.ceil(f.bytes / 1024)} KB</span>
            <button
              disabled={busy}
              onClick={() => void mutate(`files/${f.id}`, { method: "DELETE" })}
            >
              {f.removalPending ? "Retry removal" : "Remove file"}
            </button>
          </div>
        ))}
        <input
          aria-label="Attach a file"
          hidden
          ref={fileInput}
          tabIndex={-1}
          type="file"
          disabled={busy}
          accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.json,.zip"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 26214400) {
              setError("Files must be 25 MB or smaller.");
              return;
            }
            setFilesOpen(true);
            void mutate("files", {
              method: "POST",
              headers: {
                "Content-Type": file.type,
                "X-File-Name": encodeURIComponent(file.name),
                "X-File-Name-Encoding": "uri",
              },
              body: file,
            });
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="discussion-file-picker"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          Attach file
        </button>
      </details>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
