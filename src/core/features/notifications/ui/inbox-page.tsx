import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  createApiResourceController,
  fetchJson,
  isUnavailableResourceError,
  type ResourceState,
} from "../../../app/api-client";
import type { InboxPage, InboxItem } from "../schema";
import { inboxPageFailure, visibleInboxItems } from "./inbox-state";
import {
  countSchema,
  fetchCurrentInboxPage,
  fetchNotificationInbox,
} from "./data";
import { useNotifications } from "./notification-context";
import { relativeTime } from "../../streams/ui/helpers";
import "./notifications.css";
const actions = {
  mention: "mentioned you",
  assignment: "assigned you",
  comment: "commented on",
  intake_return: "returned your deferred intake",
  unblocked: "removed the last blocker from",
  due_reminder: "has a due reminder for",
};
function action(item: InboxItem) {
  const kind = (
    [
      "mention",
      "assignment",
      "comment",
      "intake_return",
      "unblocked",
      "due_reminder",
    ] as const
  ).find((value) => item.causes.includes(value));
  return kind ? actions[kind] : "updated";
}

export function InboxEmptyState() {
  return (
    <div className="inbox-empty">
      <p>Nothing new.</p>
      <p>You're all caught up. Assignments and mentions will appear here.</p>
    </div>
  );
}

export function InboxNotificationRow({
  item,
  pending,
  onOpen,
}: {
  item: InboxItem;
  pending: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={`inbox-row${item.readAt ? "" : " is-unread"}`}
      disabled={!!pending}
      onClick={onOpen}
    >
      <span className="inbox-read-state">
        {item.readAt ? "Read" : "Unread"}
      </span>
      <span className="inbox-row-copy">
        <span>
          {item.actor ?? "An operator"} {action(item)}{" "}
          <strong className="inbox-identifier">{item.identifier}</strong>
        </span>
        <span className="inbox-title">{item.title}</span>
        <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
      </span>
      {pending === item.id && <span role="status">Opening…</span>}
    </button>
  );
}

export function InboxPageView() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [state, setState] = useState<ResourceState<InboxPage>>({
    data: null,
    error: null,
    loading: true,
  });
  const [older, setOlder] = useState<InboxItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<ReturnType<
    typeof createApiResourceController<InboxPage>
  > | null>(null);
  const pageAbort = useRef<AbortController | null>(null);
  const active = useRef(true);
  const mutation = useRef(false);
  const generation = useRef(0);
  const paging = useRef(false);
  const previous = useRef<InboxItem[]>([]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    active.current = true;
    const current = createApiResourceController(
      () => fetchNotificationInbox(),
      (next) => {
        if (!active.current) return;
        if (next.data) {
          if (paging.current)
            setOlder((current) =>
              [...previous.current, ...current].filter(
                (item, index, all) =>
                  all.findIndex((other) => other.id === item.id) === index,
              ),
            );
          else setCursor(next.data.nextCursor);
          previous.current = next.data.items;
        } else if (next.error) {
          if (isUnavailableResourceError(next.error)) {
            ++generation.current;
            controller.current?.dispose();
            pageAbort.current?.abort();
            setPending(null);
            notifications.deny(next.error);
          }
          setOlder([]);
          setCursor(null);
          previous.current = [];
          paging.current = false;
        }
        setState(next);
      },
    );
    controller.current = current;
    void current.refresh();
    const refresh = () => {
      if (!mutation.current && document.visibilityState === "visible")
        void current.refresh({ skipIfPending: true });
    };
    const timer = window.setInterval(refresh, 2000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active.current = false;
      ++generation.current;
      current.dispose();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      pageAbort.current?.abort();
    };
  }, [revision]);
  const items = visibleInboxItems(state, older);
  async function read(id?: string, identifier?: string) {
    if (mutation.current) return;
    mutation.current = true;
    ++generation.current;
    controller.current?.dispose();
    pageAbort.current?.abort();
    notifications.invalidate();
    setPending(id ?? "all");
    setError("");
    try {
      const receipt = await fetchJson(
        id
          ? `/api/notifications/${encodeURIComponent(id)}/read`
          : "/api/notifications/read-all",
        countSchema,
        { method: "POST" },
      );
      if (!active.current) return;
      notifications.accept(receipt.unreadCount);
      paging.current = false;
      previous.current = [];
      setOlder([]);
      setRevision((value) => value + 1);
      if (identifier)
        await navigate({
          to: "/app/issues/$identifier",
          params: { identifier },
        });
    } catch (cause) {
      if (active.current) {
        const error =
          cause instanceof Error
            ? cause
            : new Error("Unable to mark notifications read.");
        setError(error.message);
        if (isUnavailableResourceError(error)) {
          setState((current) => inboxPageFailure(current, error).state);
          setOlder([]);
          setCursor(null);
          previous.current = [];
          paging.current = false;
          notifications.deny(error);
        } else {
          setRevision((value) => value + 1);
          notifications.refresh();
        }
      }
    } finally {
      mutation.current = false;
      if (active.current) setPending(null);
    }
  }
  async function more() {
    if (
      !cursor ||
      pending ||
      mutation.current ||
      (pageAbort.current && !pageAbort.current.signal.aborted)
    )
      return;
    const own = generation.current;
    const abort = new AbortController();
    pageAbort.current = abort;
    setPending("more");
    setError("");
    try {
      const page = await fetchCurrentInboxPage(cursor, abort.signal);
      if (!page || !active.current || own !== generation.current) return;
      paging.current = true;
      setOlder((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch (cause) {
      if (
        active.current &&
        own === generation.current &&
        !abort.signal.aborted
      ) {
        const error =
          cause instanceof Error
            ? cause
            : new Error("Unable to load more notifications.");
        const failure = inboxPageFailure(state, error);
        setState((current) => inboxPageFailure(current, error).state);
        setError(error.message);
        if (failure.denied) {
          ++generation.current;
          controller.current?.dispose();
          abort.abort();
          setOlder([]);
          setCursor(null);
          previous.current = [];
          paging.current = false;
          setPending(null);
          notifications.deny(error);
        }
      }
    } finally {
      if (pageAbort.current === abort) pageAbort.current = null;
      if (active.current && own === generation.current && !abort.signal.aborted)
        setPending(null);
    }
  }
  return (
    <main className="inbox-page">
      <header>
        <div>
          <p className="settings-eyebrow">Your work</p>
          <h1>Inbox</h1>
          <p>
            {notifications.state.error
              ? "Unread count unavailable"
              : notifications.state.data
                ? `${notifications.state.data.unreadCount} unread`
                : "Loading unread count…"}
          </p>
        </div>
        <button
          type="button"
          disabled={
            !!pending ||
            !state.data ||
            items.length === 0 ||
            notifications.state.data?.unreadCount === 0
          }
          onClick={() => void read()}
        >
          {pending === "all" ? "Marking read…" : "Mark all read"}
        </button>
      </header>
      {state.loading && !state.data && <p role="status">Loading inbox…</p>}
      {(state.error || error || notifications.state.error) && (
        <p role="alert">
          {error || state.error?.message || notifications.state.error?.message}{" "}
          {state.data && "Showing the last loaded inbox."}{" "}
          <button
            type="button"
            disabled={!!pending}
            onClick={() => {
              setRevision((value) => value + 1);
              notifications.refresh();
            }}
          >
            Retry inbox
          </button>
        </p>
      )}
      {state.data && items.length === 0 && <InboxEmptyState />}
      <ul className="inbox-list">
        {items.map((item) => (
          <li key={item.id}>
            <InboxNotificationRow
              item={item}
              pending={pending}
              onOpen={() => void read(item.id, item.identifier)}
            />
          </li>
        ))}
      </ul>
      {state.data && cursor && (
        <button type="button" disabled={!!pending} onClick={() => void more()}>
          {pending === "more" ? "Loading…" : "Load more notifications"}
        </button>
      )}
    </main>
  );
}
