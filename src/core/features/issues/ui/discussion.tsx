import { MentionTextarea } from "../../notifications/ui/mention-textarea";
import { useRef, useState } from "react";
import { z } from "zod";
import { useApiResource } from "../../../app/api-client";
import { SafeMarkdown } from "../../markdown/ui/markdown";
import { NamedLinks } from "../../links/ui/named-links";
import { namedLinksSchema } from "../../links/schema";
import { relativeTime } from "../../streams/ui/helpers";
const schema = z.object({
  links: namedLinksSchema.shape.links,
  comments: z.array(
    z.object({
      id: z.string(),
      body: z.string().nullable(),
      actor: z.string(),
      imported: z.union([z.boolean(), z.number()]).transform(Boolean).optional(),
      editedAt: z.string().nullable(),
      deletedAt: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  files: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      contentType: z.string(),
      bytes: z.number(),
      state: z.enum(["pending", "ready", "failed"]),
      removalPending: z.string().nullable(),
      cleanupError: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});

export function CommentTimestamp({
  createdAt,
  editedAt,
}: {
  createdAt: string;
  editedAt: string | null;
}) {
  return (
    <small className="comment-timestamp">
      <time dateTime={createdAt}>{relativeTime(createdAt)}</time>
      {editedAt ? (
        <>
          {" · edited "}
          <time dateTime={editedAt}>{relativeTime(editedAt)}</time>
        </>
      ) : null}
    </small>
  );
}

export function Discussion({
  identifier,
  onRefresh,
}: {
  identifier: string;
  onRefresh: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const resource = useApiResource(
      `/api/issues/${identifier}/discussion`,
      schema,
    ),
    [filesOpen, setFilesOpen] = useState(false),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [edit, setEdit] = useState<string | null>(null),
    [editBody, setEditBody] = useState("");
  async function mutate(
    path: string,
    init: RequestInit,
    onSuccess?: () => void,
  ) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/issues/${identifier}/${path}`, init);
      if (!response.ok) {
        const data = z
          .object({ message: z.string().optional() })
          .parse(await response.json());
        throw new Error(data.message ?? `Action failed (${response.status}).`);
      }
      await response.arrayBuffer();
      onSuccess?.();
      resource.refreshAfterMutation();
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
      {resource.data?.comments.map((c) => (
        <article className="comment-entry" key={c.id}>
          <strong>{c.actor}</strong>{c.imported ? <span> (imported)</span> : null}
          <CommentTimestamp createdAt={c.createdAt} editedAt={c.editedAt} />
          {c.deletedAt ? (
            <p>Comment deleted</p>
          ) : edit === c.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void mutate(
                  `comments/${c.id}`,
                  json("PATCH", { body: editBody }),
                  () => setEdit(null),
                );
              }}
            >
              <label>
                Edit comment
                <MentionTextarea
                  aria-label="Edit comment"
                  required
                  disabled={busy}
                  value={editBody}
                  onValueChange={setEditBody}
                />
              </label>
              <button disabled={busy}>Save comment</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <div className="comment-body">
                <SafeMarkdown>{c.body ?? ""}</SafeMarkdown>
              </div>
              <NamedLinks
                identifier={identifier}
                commentId={c.id}
                links={resource.data?.links ?? []}
                onRefresh={() => {
                  resource.refreshAfterMutation();
                  onRefresh();
                }}
              />
              <button
                disabled={busy}
                onClick={() => {
                  setEdit(c.id);
                  setEditBody(c.body ?? "");
                }}
              >
                Edit comment
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void mutate(`comments/${c.id}`, { method: "DELETE" })
                }
              >
                Delete comment
              </button>
            </>
          )}
        </article>
      ))}
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
            disabled={busy}
            value={body}
            onValueChange={setBody}
          />
        </label>
        <button disabled={busy} type="submit">
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
              <a href={`/api/issues/${identifier}/files/${f.id}`}>{f.name}</a>
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
