import { useEffect, useState } from "react";
import { z } from "zod";
import { useApiResource } from "../../../app/api-client";
import { discussionSchema } from "../../discussion/schema";

export function useDiscussion(identifier: string, onRefresh: () => void) {
  const resource = useApiResource(
      `/api/issues/${identifier}/discussion`,
      discussionSchema,
      undefined,
      { abortPendingOnDispose: false },
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function mutate(
    path: string,
    init: RequestInit,
    onSuccess?: () => void,
  ) {
    setBusy(true);
    setError("");
    try {
      const comment = (path === "comments" || /^comments\/[^/]+\/checklist$/.test(path)) && init.method === "POST";
      const headers = new Headers(init.headers);
      if (comment) headers.set("x-vector-projection", "discussion");
      const response = await fetch(`/api/issues/${identifier}/${path}`, { ...init, headers });
      if (!response.ok) {
        const data = z
          .object({ message: z.string().optional() })
          .parse(await response.json());
        throw new Error(data.message ?? `Action failed (${response.status}).`);
      }
      if (comment) {
        const receipt = z.object({ discussion: discussionSchema }).parse(await response.json());
        resource.publishReceipt(() => receipt.discussion);
      } else {
        await response.arrayBuffer();
        resource.refreshAfterMutation();
      }
      onSuccess?.();
      window.dispatchEvent(new CustomEvent("vector:discussion-changed", { detail: identifier }));
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
      resource.reload();
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const refresh = (event: Event) => {
      if ((event as CustomEvent).detail === identifier) resource.refreshAfterMutation();
    };
    window.addEventListener('vector:discussion-changed', refresh);
    return () => window.removeEventListener('vector:discussion-changed', refresh);
  }, [identifier, resource.refreshAfterMutation]);
  return { resource, busy, error, mutate };
}
