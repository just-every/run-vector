import { useState } from "react";
import type { IssueEmail } from "./schema";
import "./email-intake.css";

export function EmailRequester({ email, identifier }: { email: IssueEmail; identifier: string }) {
  if (!email.thread) return null;
  return <section className="email-requester" aria-label="Email requester">
    <h3>Email requester</h3>
    <p>{email.thread.requester} · {email.thread.subject}</p>
    {email.thread.cc.length > 0 && <p>Cc: {email.thread.cc.join(", ")}</p>}
    <p>Customer domain mapping is unavailable. This requester has no Vector seat or sign-in.</p>
    {email.deliveries.filter(delivery => delivery.kind === "acknowledgement").map(delivery => <p key={delivery.createdAt} role="status" aria-label="Acknowledgement delivery outcome">Acknowledgement delivery: {delivery.status}</p>)}
    {email.messages.filter(message => message.commentId === null).map(message => <section key={message.id} aria-label="Original email">
      <p className="email-original-body">{message.text}</p>
      <EmailAttachments identifier={identifier} attachments={message.attachments} />
    </section>)}
  </section>;
}

export function CommentEmailDetails({ email, commentId, identifier }: {
  email: IssueEmail; commentId: string; identifier: string;
}) {
  return <>
    {email.messages.filter(message => message.commentId === commentId).map(message => <section key={message.id} aria-label="Received email">
      <p>Received by email from {message.sender} · {message.subject}</p>
      <EmailAttachments identifier={identifier} attachments={message.attachments} />
    </section>)}
    {email.deliveries.filter(delivery => delivery.commentId === commentId).map((delivery, index) => <p key={`${delivery.createdAt}-${index}`} role="status" aria-label="Email delivery outcome">
      Email delivery: {delivery.status}{delivery.status === "accepted" ? " · Provider accepted; inbox delivery is not confirmed." : ""}
      {delivery.status === "bounced" ? " · The provider reported a bounce or dropped message." : ""}
      {delivery.status === "uncertain" ? " · Delivery could not be confirmed. Check the provider before sending another reply." : ""}
      {delivery.error ? ` · ${delivery.error}` : ""}
    </p>)}
  </>;
}

function EmailAttachments({ identifier, attachments }: {
  identifier: string; attachments: IssueEmail["messages"][number]["attachments"];
}) {
  return <>{attachments.map(attachment => {
    const href = `/api/issues/${encodeURIComponent(identifier)}/files/${encodeURIComponent(attachment.fileId)}`;
    return <div className="email-attachment" key={attachment.fileId}>
      {attachment.contentId && ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(attachment.contentType)
        ? <InlineEmailImage href={href} filename={attachment.filename} />
        : null}
      <a href={href} download={attachment.filename}>{attachment.filename}</a>
    </div>;
  })}</>;
}

function InlineEmailImage({ href, filename }: { href: string; filename: string }) {
  const [open, setOpen] = useState(false);
  return <span className="markdown-image">
    {open && <img src={href} alt={filename} loading="lazy" />}
    <button type="button" onClick={() => setOpen(!open)}>{open ? "Hide inline image" : `View inline image: ${filename}`}</button>
  </span>;
}
