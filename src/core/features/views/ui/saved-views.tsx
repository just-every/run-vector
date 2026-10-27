import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ApiError,
  fetchJson,
  isUnavailableResourceError,
  useApiResource,
} from "../../../app/api-client";
import type { IssueListQuery } from "../../issues/list-schema";
import { savedViewSchema, type SavedView } from "../schema";
import {
  savedViewsSchema,
  useSavedViewReceiptScope,
  useSavedViewReceiptPublisher,
  useSavedViewNavigation,
} from "./saved-view-resource";
export { savedViewsSchema } from "./saved-view-resource";
// Read once while the form is open: a receipt-subscribed reader here would re-read on Create
// and be cut off by the navigation to the new view.
function ViewLimit({ limit, ownerId }: { limit: number; ownerId: string }) {
  const views = useApiResource("/api/views", savedViewsSchema);
  const owned = views.data?.views.filter((view) => view.ownerOperatorId === ownerId).length;
  return owned !== undefined && owned >= limit - 5 ? <> {owned} of {limit} saved views used.</> : null;
}
export function SaveView({
  query,
  layout,
  canShare,
  limit,
  ownerId,
  onCreated,
}: {
  query: IssueListQuery;
  layout: "list" | "board";
  canShare:boolean;
  limit?: number;
  ownerId?: string;
  onCreated: (id: string) => void;
}) {
  const publishReceipt = useSavedViewReceiptPublisher();
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [shared, setShared] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const view = await fetchJson("/api/views", savedViewSchema, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          isShared: shared,
          layout,
          query: { ...query, offset: 0 },
        }),
      });
      if (publishReceipt(view, "created")) onCreated(view.id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save view.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="saved-view-author">
      <button aria-expanded={open} onClick={() => setOpen(!open)}>
        Save view
      </button>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            View name
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {canShare && <label className="saved-view-check">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
            Shared with workspace
          </label>}
          <p>
            Private views are only visible to you.
            {limit !== undefined && ownerId !== undefined && <ViewLimit limit={limit} ownerId={ownerId} />}
          </p>
          <button disabled={busy || !name.trim()}>
            {busy ? "Saving…" : "Create view"}
          </button>
        </form>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
export function SavedViewActions({
  view,
  operatorId,
  canShare,
  query,
  layout,
}: {
  view: SavedView;
  operatorId: string;
  canShare:boolean;
  query: IssueListQuery;
  layout: "list" | "board";
}) {
  const navigate = useNavigate();
  const publishReceipt = useSavedViewReceiptPublisher();
  const { deny: denyReceipt } = useSavedViewReceiptScope();
  const [name, setName] = useState(view.name),
    [shared, setShared] = useState(view.isShared),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [deleteReady, setDeleteReady] = useState(false);
  const owner = view.ownerOperatorId === operatorId;
  useEffect(() => {
    setName(view.name);
    setShared(view.isShared);
    setDeleteReady(false);
  }, [view.id, view.name, view.isShared]);
  async function mutate(action: "update" | "rename" | "duplicate" | "delete") {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      if (action === "delete") {
        const response = await fetch(`/api/views/${view.id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const body = (await response.json()) as { message?: string };
          throw new ApiError(response.status, {
            message: body.message ?? "Could not delete view.",
          });
        }
        denyReceipt(view.id, null);
        void navigate({ to: "/app/issues" });
        return;
      }
      const receipt = await fetchJson(
        `/api/views/${view.id}${action === "duplicate" ? "/duplicate" : ""}`,
        savedViewSchema,
        {
          method: action === "duplicate" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            action === "duplicate"
              ? { name }
              : action === "rename"
                ? { name, isShared: shared }
                : {
                    name,
                    isShared: shared,
                    query: { ...query, offset: 0 },
                    layout,
                  },
          ),
        },
      );
      if (action === "duplicate") {
        if (!publishReceipt(receipt, "created")) return;
        void navigate({
          to: "/app/views/$viewId",
          params: { viewId: receipt.id },
        });
      } else {
        setMessage(
          action === "rename"
            ? "View name and visibility saved."
            : "View controls saved.",
        );
        publishReceipt(receipt);
      }
    } catch (e) {
      if (isUnavailableResourceError(e))
        denyReceipt(
          e instanceof ApiError && e.status === 401 ? undefined : view.id,
          e as Error,
        );
      setFailed(true);
      setMessage(e instanceof Error ? e.message : "Could not change view.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="saved-view-author" aria-label="Saved view actions">
      <p>
        {view.isShared ? "Shared view" : "Private view"} ·{" "}
        {owner
          ? "Owned by you"
          : "Only its owner can update or delete this view."}
      </p>
      <label>
        {owner ? "View name" : "Duplicate name"}
        <input
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {owner && canShare && (
        <label className="saved-view-check">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
          />
          Shared with workspace
        </label>
      )}
      <div className="saved-view-buttons">
        {owner && (
          <>
            <button
              disabled={busy || !name.trim()}
              onClick={() => void mutate("rename")}
            >
              Rename / visibility
            </button>
            <button
              disabled={busy || !name.trim()}
              onClick={() => void mutate("update")}
            >
              Update saved controls
            </button>
          </>
        )}
        <button
          disabled={busy || !name.trim()}
          onClick={() => void mutate("duplicate")}
        >
          Duplicate view
        </button>
        {owner &&
          (deleteReady ? (
            <>
              <span>Delete “{view.name}”? Issues stay unchanged.</span>
              <button disabled={busy} onClick={() => void mutate("delete")}>
                Confirm delete
              </button>
              <button onClick={() => setDeleteReady(false)}>Cancel</button>
            </>
          ) : (
            <button disabled={busy} onClick={() => setDeleteReady(true)}>
              Delete view
            </button>
          ))}
      </div>
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
    </section>
  );
}
export function SavedViewNavigation() {
  const resource = useSavedViewNavigation();
  const views = isUnavailableResourceError(resource.error)
    ? null
    : resource.data?.views;
  return (
    <nav className="saved-view-navigation" aria-label="Saved views">
      <h2>Saved views</h2>
      {resource.error && (
        <p role="alert">
          Views unavailable. <button onClick={resource.reload}>Retry</button>
        </p>
      )}
      {resource.loading && <p>Loading views…</p>}
      {views?.length
        ? views.map((view) => (
            <Link
              key={view.id}
              activeProps={{ className: "is-active", "aria-current": "page" }}
              to="/app/views/$viewId"
              params={{ viewId: view.id }}
            >
              <span>{view.name}</span>
              <small>{view.isShared ? "Shared" : "Private"}</small>
            </Link>
          ))
        : views && (
            <p>
              No saved views yet.{" "}
              <Link to="/app/issues" activeOptions={{ exact: true }}>Save your issue controls as a view.</Link>
            </p>
          )}
    </nav>
  );
}
