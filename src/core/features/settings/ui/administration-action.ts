import { useState } from "react";
import { administrationSchema } from "../../administration/schema";
import { fetchJson } from "../../../app/api-client";

export function useAdministrationAction(onChanged: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(
    path: string,
    method: string,
    body?: unknown,
  ): Promise<boolean> {
    if (pending) return false;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await fetchJson(path, administrationSchema, {
        method,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      setMessage("Saved.");
      onChanged();
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The change could not be saved.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, error, message, run, reload: onChanged };
}
export type AdministrationAction = ReturnType<typeof useAdministrationAction>;
