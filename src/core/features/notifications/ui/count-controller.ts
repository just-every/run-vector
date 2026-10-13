import {
  createApiResourceController,
  type ResourceState,
} from "../../../app/api-client.ts";
/** A mutation invalidates every earlier count request, even if abort is ignored. */
export function createNotificationCountController(
  load: (signal: AbortSignal) => Promise<{ unreadCount: number }>,
  publish: (state: ResourceState<{ unreadCount: number }>) => void,
) {
  let current: ResourceState<{ unreadCount: number }> = {
    data: null,
    error: null,
    loading: true,
  };
  let generation = 0;
  let disposed = false;
  let controller = makeController();
  function makeController() {
    const own = ++generation;
    return createApiResourceController(
      load,
      (state) => {
        if (!disposed && own === generation) {
          current = state;
          publish(state);
        }
      },
      current,
    );
  }
  return {
    refresh() {
      return controller.refresh({ skipIfPending: true });
    },
    accept(unreadCount: number) {
      if (disposed) return;
      controller.dispose();
      current = { data: { unreadCount }, error: null, loading: false };
      controller = makeController();
      publish(current);
    },
    deny(error: Error) {
      if (disposed) return;
      current = { data: null, error, loading: false };
      // Retire this generation without aborting its transport. Its late result
      // cannot publish, and an authorization denial need not cancel a native read.
      controller = makeController();
      publish(current);
    },
    invalidate() {
      if (disposed) return;
      controller.dispose();
      controller = makeController();
    },
    dispose() {
      disposed = true;
      controller.dispose();
    },
  };
}
