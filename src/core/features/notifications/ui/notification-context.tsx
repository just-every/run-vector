import "./inbox-count.css";
import { MentionOperatorsProvider } from "./mention-operators";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ResourceState } from "../../../app/api-client";
import { fetchNotificationCount } from "./data";
import { countSchema } from './data';
import { useInitialResource } from '../../../app/initial-resources';
import { createNotificationCountController } from "./count-controller";
const Context = createContext<{
  state: ResourceState<{ unreadCount: number }>;
  accept: (count: number) => void;
  invalidate: () => void;
  deny: (error: Error) => void;
  refresh: () => void;
} | null>(null);
export function NotificationProvider({ children }: { children: ReactNode }) {
  const initial = useInitialResource('/api/notifications/count', countSchema);
  const [state, setState] = useState<ResourceState<{ unreadCount: number }>>({
    data: initial,
    error: null,
    loading: initial === null,
  });
  const controller = useRef<ReturnType<
    typeof createNotificationCountController
  > | null>(null);
  useEffect(() => {
    const current = createNotificationCountController(
      fetchNotificationCount,
      setState,
    );
    controller.current = current;
    if (initial !== null) current.accept(initial.unreadCount);
    else void current.refresh();
    const refresh = () => {
      if (document.visibilityState === "visible") void current.refresh();
    };
    const timer = window.setInterval(refresh, 2000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      current.dispose();
      controller.current = null;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [initial]);
  return (
    <MentionOperatorsProvider>
      <Context.Provider
        value={{
          state,
          accept: (count) => controller.current?.accept(count),
          invalidate: () => controller.current?.invalidate(),
          deny: (error) => controller.current?.deny(error),
          refresh: () => {
            void controller.current?.refresh();
          },
        }}
      >
        {children}
      </Context.Provider>
    </MentionOperatorsProvider>
  );
}
export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error("Notification provider is required");
  return context;
}
export function InboxCount() {
  const { state } = useNotifications();
  return state.error ? (
    <span
      className="inbox-count-error"
      title="Unread count unavailable"
      aria-label="Unread count unavailable"
    >
      !
    </span>
  ) : state.data && state.data.unreadCount > 0 ? (
    <span
      className="inbox-count"
      aria-label={`${state.data.unreadCount} unread`}
    >
      {state.data.unreadCount > 99 ? "99+" : state.data.unreadCount}
    </span>
  ) : null;
}
