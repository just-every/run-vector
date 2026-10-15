import { useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { productConfig } from "../config";
import { Door } from "../site/door/door";
import { SignInDrawing } from "../site/door/door-drawings";
import { links } from "../site/shell/links";

/** /signin: one email field that asks for a single-use sign-in link. Local development has its own automatic owner entry. */
export function SignInPage({ providerLinks = [], loginHint = '' }: { loginHint?: string; providerLinks?: {id: string; label: string; startPath: string}[] }) {
  const search = useSearch({ strict: false }) as { returnTo?: string };
  const [email, setEmail] = useState(loginHint),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, returnTo: search.returnTo }),
      });
      const body = z
        .object({
          message: z.string().optional(),
          error: z.string().optional(),
        })
        .parse(await response.json());
      if (!response.ok)
        throw new Error(
          (body.error === 'mail_unavailable'
            ? 'Sign-in email is unavailable. Ask the workspace owner to check its mail settings.'
            : body.message) ??
            body.error ??
            `Sign-in could not be requested (${response.status}).`,
        );
      setMessage(
        "Check your inbox for your single-use sign-in link. It may take a moment to arrive; check your spam folder too.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Door drawing={<SignInDrawing productName={productConfig.productName} />}>
      <div aria-labelledby="sign-in-heading">
        <h1 id="sign-in-heading">Sign in to your workspace</h1>
        <p className="vx-door-lead">
          Use your invited email address to receive a single-use sign-in link.
        </p>
        <form className="vx-door-form" onSubmit={submit}>
          <label className="vx-door-field">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              disabled={!ready || busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="vx-pill" disabled={!ready || busy} type="submit">
            {busy ? "Sending…" : "Send sign-in link"}
          </button>
        </form>
        {providerLinks.map(link => <form key={link.id} method="post" action={link.startPath}>
          <input type="hidden" name="returnTo" value={search.returnTo ?? "/app"} />
          <button className="vx-pill" type="submit">Continue with {link.label}</button>
        </form>)}
        {message ? (
          <p className="vx-door-notice" role="status">
            {message}
          </p>
        ) : null}
        <p className="vx-door-back"><a href={links.home}>← Return to welcome</a></p>
      </div>
    </Door>
  );
}
