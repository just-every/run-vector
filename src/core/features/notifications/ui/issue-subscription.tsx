import { useEffect, useState } from "react";
import { fetchJson, useApiResource } from "../../../app/api-client";
import { subscriptionSchema } from "./data";
import "./notifications.css";
export function IssueSubscriptionControls({
  identifier,
}: {
  identifier: string;
}) {
  const url = `/api/issues/${encodeURIComponent(identifier)}/subscription`;
  // Current can replace its default inspector during a fresh stream receipt.
  // Stop its poller while allowing an already admitted read to drain.
  const resource = useApiResource(url, subscriptionSchema, 3000, {
    abortPendingOnDispose: false,
  });
  const [own, setOwn] = useState<{ following: boolean; muted: boolean } | null>(
    null,
  );
  useEffect(() => {
    setOwn(resource.data);
  }, [resource.data]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function change(patch: { following?: boolean; muted?: boolean }) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const updated = await fetchJson(url, subscriptionSchema, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      setOwn(updated);
      resource.refreshAfterMutation();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save following preferences.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="issue-subscription" role="group" aria-label="Your issue notifications">
      {resource.loading && <span role="status">Loading following…</span>}
      {resource.data && own && (
        <>
          <button
            type="button"
            disabled={pending || resource.loading}
            aria-pressed={own.following}
            onClick={() => void change({ following: !own!.following })}
          >
            {own.following ? "Unfollow" : "Follow"}
          </button>
          <button
            type="button"
            disabled={pending || resource.loading}
            aria-pressed={own.muted}
            onClick={() => void change({ muted: !own!.muted })}
          >
            {own.muted ? "Unmute" : "Mute"}
          </button>
        </>
      )}
      {pending && <span role="status">Saving…</span>}
      {(error || resource.error) && (
        <span role="alert">
          {error || resource.error?.message}{" "}
          <button type="button" disabled={pending} onClick={resource.reload}>
            Retry following
          </button>
        </span>
      )}
    </div>
  );
}
