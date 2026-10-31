import { CommentComposer } from '../../drafts/comment-composer';
import { Reactions, ReactionProvider } from "../../reactions/ui";
import { useRef, useState } from "react";
import { useApiResource } from "../../../app/api-client";
import { useHydrated } from '../../../app/initial-resources';
import { NamedLinks } from "../../links/ui/named-links";
import { useDiscussion } from "./discussion-client";
import { CommentThread, commentThreads } from "./discussion-thread";
import { issueEmailSchema } from "../../email-intake/ui/schema";
import { EmailRequester } from "../../email-intake/ui/email-discussion";
import { EmailReply } from "../../email-intake/ui/email-reply";


export { CommentTimestamp } from "./discussion-thread";

type DiscussionProps = {writable?:boolean;identifier:string;onRefresh:()=>void};
export function Discussion(props:DiscussionProps) {
  return <ReactionProvider identifier={props.identifier}><DiscussionContents {...props}/></ReactionProvider>;
}
function DiscussionContents({
  identifier,
  onRefresh,
  writable = true,
}: {
  writable?: boolean;
  identifier: string;
  onRefresh: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();
  const email = useApiResource(`/api/issues/${identifier}/email-intake`, issueEmailSchema, 4000, {
    abortPendingOnDispose: false,
  });
  function emailSent() {
    email.refreshAfterMutation();
    resource.refreshAfterMutation();
    onRefresh();
  }
  const { resource, busy, error, mutate } = useDiscussion(identifier, onRefresh);
  const [filesOpen, setFilesOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  return (
    <section className="detail-section">
      <Reactions identifier={identifier} writable={writable} />
      <h2>Discussion</h2>
      {email.error && <p role="alert">{email.error.message} <button type="button" onClick={email.reload}>Retry email conversation</button></p>}
      {email.data && <EmailRequester email={email.data} identifier={identifier} />}
      {resource.error ? (
        <p role="alert">
          {resource.error.message}
          <button onClick={resource.reload}>Retry discussion</button>
        </p>
      ) : null}
      {resource.data
        ? commentThreads(resource.data.comments).filter(({ root }) => !root.anchor).map(({ root, replies }) => (
            <CommentThread writable={writable}
              key={root.id}
              root={root}
              replies={replies}
              identifier={identifier}
              data={resource.data!}
              busy={busy}
              email={email.data}
              onEmailSent={emailSent}
              mutate={mutate}
              onLinksChanged={() => {
                resource.refreshAfterMutation();
                onRefresh();
              }}
            />
          ))
        : null}
      {writable && <CommentComposer key={identifier} identifier={identifier} busy={busy || !hydrated} mutate={mutate}/>}
      {writable && email.data?.canReply && email.data.thread && <EmailReply identifier={identifier} requester={email.data.thread.requester} cc={email.data.thread.cc} onSent={emailSent} />}
      <NamedLinks writable={writable}
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
              disabled={!writable || busy}
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
          disabled={!writable || busy}
          accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.json,.zip"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 26214400) {
              setUploadError("Files must be 25 MB or smaller.");
              return;
            }
            setUploadError("");
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
          disabled={!writable || busy}
          onClick={() => fileInput.current?.click()}
        >
          Attach file
        </button>
      </details>
      {error || uploadError ? <p role="alert">{error || uploadError}</p> : null}
    </section>
  );
}
