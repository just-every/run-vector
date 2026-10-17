import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  fetchJson,
  isUnavailableResourceError,
  useApiResource,
} from "../../../app/api-client";
import { followUpTime } from "./follow-up-time";

const remindersSchema = z.object({
  reminders: z.array(
    z.object({ id: z.string(), remindAt: z.string(), createdAt: z.string() }),
  ),
});

export function usePersonalReminders(identifier: string) {
  const url = `/api/issues/${encodeURIComponent(identifier)}/reminders`;
  const resource = useApiResource(url, remindersSchema, 2000);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [denied, setDenied] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef(true);
  const mutation = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function request(
    method: "GET" | "POST" | "DELETE",
    id?: string,
    remindAt?: string,
  ) {
    if (mutation.current) return false;
    mutation.current = true;
    setPending(method === "GET" ? "reload" : (id ?? "create"));
    setError(null);
    setMessage("");
    try {
      const receipt = await fetchJson(
        id ? `${url}/${encodeURIComponent(id)}` : url,
        remindersSchema,
        {
          method,
          ...(remindAt
            ? {
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ remindAt }),
              }
            : {}),
        },
      );
      if (!active.current) return false;
      resource.publishReceipt(() => receipt);
      resource.refreshAfterMutation();
      setDenied(false);
      if (method !== "GET")
        setMessage(
          remindAt
            ? `Personal reminder set for ${followUpTime(remindAt)}.`
            : "Personal reminder canceled.",
        );
      return true;
    } catch (cause) {
      if (active.current) {
        const error =
          cause instanceof Error
            ? cause
            : new Error("Unable to update personal reminders.");
        setError(error);
        if (isUnavailableResourceError(error)) {
          setDenied(true);
          resource.reload();
        }
      }
      return false;
    } finally {
      mutation.current = false;
      if (active.current) setPending(null);
    }
  }

  const reminders = denied ? null : (resource.data?.reminders ?? null);
  return {
    reminders,
    loading: resource.loading,
    pending,
    error: isUnavailableResourceError(resource.error)
      ? resource.error
      : (error ?? resource.error),
    message: reminders === null ? "" : message,
    create: (remindAt: string) => request("POST", undefined, remindAt),
    cancel: (id: string) => request("DELETE", id),
    retry: () => {
      void request("GET");
    },
  };
}
