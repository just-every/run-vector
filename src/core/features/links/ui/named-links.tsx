import { useId, useState } from "react";
import { createLinkSchema, type NamedLink } from "../schema";

export function NamedLinks({
  identifier,
  commentId,
  onRefresh,
  links: suppliedLinks,
  writable = true,
}: {
  writable?: boolean;
  identifier: string;
  commentId?: string;
  onRefresh: () => void;
  links: NamedLink[];
}) {
  const path = `/api/issues/${encodeURIComponent(identifier)}/links`;
  const [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const formId = useId();
  async function mutate(method: "POST" | "DELETE", id?: string) {
    const parsed =
      method === "POST"
        ? createLinkSchema.safeParse({
            name,
            url,
            ...(commentId ? { commentId } : {}),
          })
        : null;
    if (parsed && !parsed.success) {
      setError(
        "Enter a name and a HTTPS URL without credentials or control characters.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(id ? `${path}/${id}` : path, {
        method,
        headers:
          method === "POST"
            ? { "Content-Type": "application/json" }
            : undefined,
        body: parsed?.success ? JSON.stringify(parsed.data) : undefined,
      });
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "This issue, comment or link no longer exists."
            : `Link action failed (${response.status}).`,
        );
      await response.arrayBuffer();
      if (method === "POST") {
        setName("");
        setUrl("");
      }
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Link action failed.");
      onRefresh();
    } finally {
      setBusy(false);
    }
  }
  const links = suppliedLinks.filter(
    (link) => link.commentId === (commentId ?? null),
  );
  return (
    <section className="named-links" aria-labelledby={`${formId}-heading`}>
      <h3
        className={links.length === 0 ? "visually-hidden" : undefined}
        id={`${formId}-heading`}
      >
        {commentId ? "Comment links" : "Links"}
      </h3>
      <details>
        <summary>
          {commentId ? "Attach link to this comment" : "Attach link"}
          {links.length ? ` · ${links.length} links` : ""}
        </summary>
        {links?.map((link) => (
          <div className="file-entry" key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              {link.name}
            </a>
            <small>{link.actor}</small>
            <button
              type="button"
              disabled={!writable || busy}
              onClick={() => void mutate("DELETE", link.id)}
            >
              Remove link
            </button>
          </div>
        ))}
        {writable && <form
          className="issue-mutation-form"
          onSubmit={(event) => {
            event.preventDefault();
            void mutate("POST");
          }}
        >
          <label>
            Name
            <input
              required
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!writable || busy}
            />
          </label>
          <label>
            HTTPS URL
            <input
              required
              type="url"
              maxLength={2000}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={!writable || busy}
            />
          </label>
          <button type="submit" disabled={!writable || busy}>
            Add link
          </button>
        </form>}
      </details>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
