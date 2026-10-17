import { ApiError, useApiResource } from "../../../app/api-client";
import { issueListSchema } from "../../issues/list-schema";

export function LoadingState({ label }: { label: string }) {
  return (
    <main className="app-state" aria-live="polite">
      <span className="app-spinner" aria-hidden="true" />
      {label}…
    </main>
  );
}
export function ErrorState({
  error,
  onRetry,
  returnTo,
}: {
  error: Error | null;
  onRetry: () => void;
  returnTo: string;
}) {
  return (
    <main className="app-state app-state--error" role="alert">
      <strong>Unable to load this workspace.</strong>
      <span>{error?.message}</span>
      {error instanceof ApiError && error.status === 401 ? (
        <a href={`/signin?returnTo=${encodeURIComponent(returnTo)}`}>
          Sign in again
        </a>
      ) : (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </main>
  );
}
export function EmptyState({
  surface,
  filtered,
}: {
  surface: "current" | "my-work";
  filtered: boolean;
}) {
  const existing = useApiResource("/api/issues", issueListSchema);
  const completed = useApiResource(
    "/api/issues?category=completed",
    issueListSchema,
  );
  const first = existing.data?.total === 0 && completed.data?.total === 0;
  return (
    <div className="stream-empty-detail">
      <h2>
        {surface === "my-work"
          ? "You're all caught up"
          : filtered
            ? "No issues match these filters"
            : first
              ? "Create your first issue"
              : "No work needs attention"}
      </h2>
      <p>
        {surface === "my-work"
          ? "Nothing assigned to you needs attention right now."
          : filtered
            ? "Adjust a filter to see the rest of the stream."
            : "Start with an issue or bring evidence into intake to decide what happens next."}
      </p>
      <a href="/app/new-issue">Create issue →</a>
      <a href="/app/issues">Browse all issues →</a>
      {surface === "my-work" ? <a href="/app">Open Current →</a> : null}
    </div>
  );
}

