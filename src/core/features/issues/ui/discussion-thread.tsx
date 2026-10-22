import { useState } from "react";
import type { z } from "zod";
import { MentionTextarea } from "../../notifications/ui/mention-textarea";
import { SafeMarkdown } from "../../markdown/ui/markdown";
import { NamedLinks } from "../../links/ui/named-links";
import type { discussionSchema } from "../../discussion/schema";
import { relativeTime } from "../../streams/ui/helpers";
import "./discussion-thread.css";
import type { IssueEmail } from "../../email-intake/ui/schema";
import { CommentEmailDetails } from "../../email-intake/ui/email-discussion";
import { EmailReply } from "../../email-intake/ui/email-reply";

type DiscussionData = z.output<typeof discussionSchema>;
type Comment = DiscussionData["comments"][number];
export type Mutate = (path: string, init: RequestInit, onSuccess?: () => void) => Promise<void>;
const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function CommentTimestamp({ createdAt, editedAt }: { createdAt: string; editedAt: string | null }) {
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

/** Group a flat, time-ordered comment list into top-level threads with their
 * replies in order. A reply whose root is missing is shown as its own thread. */
export function commentThreads(comments: Comment[]) {
  const roots = new Map<string, { root: Comment; replies: Comment[] }>();
  for (const comment of comments) if (!comment.parentId) roots.set(comment.id, { root: comment, replies: [] });
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const thread = roots.get(comment.parentId);
    if (thread) thread.replies.push(comment);
    else roots.set(comment.id, { root: comment, replies: [] });
  }
  return [...roots.values()];
}

type Shared = { identifier: string; data: DiscussionData; busy: boolean; mutate: Mutate; onLinksChanged: () => void; email?: IssueEmail | null; onEmailSent?: () => void };

export function CommentThread({ root, replies, ...shared }: Shared & { root: Comment; replies: Comment[] }) {
  const [expanded, setExpanded] = useState(false),
    [replying, setReplying] = useState(false),
    [reply, setReply] = useState("");
  const { busy, mutate } = shared;
  const resolve = (resolved: boolean) => mutate(`comments/${root.id}/resolution`, json("POST", { resolved }));
  if (root.resolvedAt && !expanded)
    return (
      <section className="comment-thread comment-thread--resolved" aria-label={`Resolved thread started by ${root.actor}`}>
        <p className="comment-thread-summary">
          <span>
            Resolved by <strong>{root.resolvedBy ?? "a removed operator"}</strong>{" "}
            <time dateTime={root.resolvedAt}>{relativeTime(root.resolvedAt)}</time>
          </span>
          <span className="comment-thread-count">
            {root.actor} · {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </span>
          <button type="button" onClick={() => setExpanded(true)}>Show thread</button>
          <button type="button" disabled={busy} onClick={() => void resolve(false)}>Reopen</button>
        </p>
      </section>
    );
  return (
    <section className="comment-thread" aria-label={`Thread started by ${root.actor}`}>
      <CommentEntry comment={root} {...shared} />
      {replies.length ? (
        <ol className="comment-replies" aria-label="Replies">
          {replies.map((comment) => (
            <li key={comment.id}>
              <CommentEntry comment={comment} {...shared} />
            </li>
          ))}
        </ol>
      ) : null}
      {replying ? (
        <form
          className="comment-reply"
          onSubmit={(event) => {
            event.preventDefault();
            void mutate("comments", json("POST", { body: reply, parentId: root.id }), () => {
              setReply("");
              setReplying(false);
            });
          }}
        >
          <MentionTextarea aria-label="Reply to thread" placeholder="Write a reply…" required maxLength={100000}
            disabled={busy} value={reply} onValueChange={setReply} />
          <button disabled={busy}>Post reply</button>
          <button type="button" disabled={busy} onClick={() => setReplying(false)}>Cancel</button>
        </form>
      ) : null}
      <div className="comment-thread-actions">
        {shared.email?.canReply && shared.email.thread && shared.onEmailSent && <EmailReply identifier={shared.identifier} requester={shared.email.thread.requester} cc={shared.email.thread.cc} parentId={root.id} onSent={shared.onEmailSent} />}
        {!replying ? <button type="button" disabled={busy} onClick={() => setReplying(true)}>Reply</button> : null}
        {root.resolvedAt ? (
          <>
            <span>
              Resolved by {root.resolvedBy ?? "a removed operator"}{" "}
              <time dateTime={root.resolvedAt}>{relativeTime(root.resolvedAt)}</time>
            </span>
            <button type="button" onClick={() => setExpanded(false)}>Collapse</button>
            <button type="button" disabled={busy} onClick={() => void resolve(false)}>Reopen</button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => void resolve(true)}>Resolve thread</button>
        )}
      </div>
    </section>
  );
}

function CommentEntry({ comment: c, identifier, data, busy, mutate, onLinksChanged, email }: Shared & { comment: Comment }) {
  const [editing, setEditing] = useState(false),
    [body, setBody] = useState("");
  return (
    <article className="comment-entry">
      <strong>{c.actor}</strong>
      {c.imported ? <span> (imported)</span> : null}
      <CommentTimestamp createdAt={c.createdAt} editedAt={c.editedAt} />
      {c.deletedAt ? (
        <p>Comment deleted</p>
      ) : editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void mutate(`comments/${c.id}`, json("PATCH", { body }), () => setEditing(false));
          }}
        >
          <label>
            Edit comment
            <MentionTextarea aria-label="Edit comment" required disabled={busy} value={body} onValueChange={setBody} />
          </label>
          <button disabled={busy}>Save comment</button>
          <button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : (
        <>
          <div className="comment-body">
            <SafeMarkdown
              taskBusy={busy}
              onTaskChange={c.canEdit ? (task) => mutate(`comments/${c.id}/checklist`, json("POST", { expectedBody: c.body, ...task })) : undefined}
            >
              {c.body ?? ""}
            </SafeMarkdown>
          </div>
          <NamedLinks identifier={identifier} commentId={c.id} links={data.links} onRefresh={onLinksChanged} />
          {email && <CommentEmailDetails email={email} commentId={c.id} identifier={identifier} />}
          {c.canEdit ? (
            <button disabled={busy} onClick={() => { setEditing(true); setBody(c.body ?? ""); }}>
              Edit comment
            </button>
          ) : null}
          {c.canDelete ? (
            <button disabled={busy} onClick={() => void mutate(`comments/${c.id}`, { method: "DELETE" })}>
              Delete comment
            </button>
          ) : null}
        </>
      )}
    </article>
  );
}
