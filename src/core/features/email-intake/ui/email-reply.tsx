import { useRef, useState, type FormEvent } from "react";
import { ApiError, fetchJson } from "../../../app/api-client";
import { createUlid } from "../../../shared/ids";
import { emailReplySchema } from "./schema";
import "./email-intake.css";

export function EmailReply({ identifier, requester, cc, parentId, onSent }: {
  identifier: string; requester: string; cc: string[]; parentId?: string; onSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(false);
  const requestId = useRef<string | null>(null);
  const submittedBody = useRef<string | null>(null);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    requestId.current ??= createUlid(new Date());
    submittedBody.current ??= body;
    setBusy(true); setError("");
    try {
      await fetchJson(`/api/issues/${identifier}/email-replies`, emailReplySchema, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: submittedBody.current, requestId: requestId.current, ...(parentId ? { parentId } : {}) }),
      });
      requestId.current = null; submittedBody.current = null;
      setBody(""); setRetry(false); setOpen(false); onSent();
    } catch (cause) {
      const rejected = cause instanceof ApiError && cause.status >= 400 && cause.status < 500;
      if (rejected) submittedBody.current = null;
      setRetry(!rejected);
      setError(cause instanceof Error ? cause.message : "The email submission could not be confirmed.");
    } finally { setBusy(false); }
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)}>Reply by email</button>;
  return <form className="issue-mutation-form comment-reply email-reply" aria-label="Reply by email" onSubmit={send}>
    <p>To: {requester}{cc.length ? ` · Cc: ${cc.join(", ")}` : ""}</p>
    <p>Only this reply is sent outside Vector. Internal comments, issue fields and status stay internal.</p>
    <label>Email reply<textarea name="emailReply" aria-label="Email reply" value={body} onChange={event => setBody(event.target.value)} required maxLength={100000} disabled={busy || retry} /></label>
    <button type="submit" disabled={busy || !body.trim()}>{busy ? "Sending…" : retry ? "Retry same email reply" : "Send reply by email"}</button>
    <button type="button" disabled={busy || retry} onClick={() => { setOpen(false); setError(""); }}>Cancel</button>
    {retry && <p>The submission is unconfirmed. Retrying uses the same request and reply to avoid a duplicate email.</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
