import type { AdministrationAction } from "./administration-action";
export function AdministrationFeedback({
  action,
}: {
  action: AdministrationAction;
}) {
  return (
    <>
      {action.pending && <p role="status">Saving…</p>}
      {action.error && (
        <p role="alert">
          {action.error}{" "}
          <button
            type="button"
            disabled={action.pending}
            onClick={action.retry}
          >
            Retry
          </button>
        </p>
      )}
      {action.message && <p role="status">{action.message}</p>}
    </>
  );
}
