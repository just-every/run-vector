import { Link, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { PublicFrame } from "./public-frame";
export function SignInPage() {
  const search = useSearch({ strict: false }) as { returnTo?: string };
  const [email, setEmail] = useState(""),
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
        .object({ message: z.string().optional(), error: z.string().optional() })
        .parse(await response.json());
      if (!response.ok)
        throw new Error(
          body.message ?? body.error ??
            `Sign-in could not be requested (${response.status}).`,
        );
      setMessage(body.message ?? "Check your email.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PublicFrame variant="mail-unavailable">
      <div aria-labelledby="sign-in-heading">
        <p className="public-kicker">Operator access</p>
        <h1 id="sign-in-heading">Sign in to your workspace</h1>
        <p className="owner-statement">
          Use your invited email address to receive a single-use sign-in link.
        </p>
        <form onSubmit={submit}>
          <label>
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
          <button
            className="primary-action"
            disabled={!ready || busy}
            type="submit"
          >
            {busy ? "Sending…" : "Send sign-in link"}
          </button>
        </form>
        {message ? (
          <p className="public-notice" role="status">
            {message}
          </p>
        ) : null}
        <Link to="/">← Return to welcome</Link>
      </div>
    </PublicFrame>
  );
}
