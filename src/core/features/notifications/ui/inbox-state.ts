import {
  isUnavailableResourceError,
  type ResourceState,
} from "../../../app/api-client.ts";
import type { InboxItem, InboxPage } from "../schema.ts";
/** Cached pages are displayable only while the current inbox read is authorized. */
export function visibleInboxItems(
  state: ResourceState<InboxPage>,
  older: InboxItem[],
): InboxItem[] {
  if (!state.data) return [];
  return [...state.data.items, ...older].filter(
    (item, index, all) =>
      all.findIndex((other) => other.id === item.id) === index,
  );
}
export function inboxPageFailure(
  state: ResourceState<InboxPage>,
  error: Error,
) {
  const denied = isUnavailableResourceError(error);
  return {
    denied,
    state: { data: denied ? null : state.data, error, loading: false },
  };
}
