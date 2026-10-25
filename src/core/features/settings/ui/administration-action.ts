import { useRef, useState } from "react";
import { administrationSchema } from "../../administration/schema";
import { fetchJson } from "../../../app/api-client";

export function useAdministrationAction(onChanged: () => void) {
  const busy = useRef(false);
  const last = useRef<{path:string;method:string;body?:unknown} | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(
    path: string,
    method: string,
    body?: unknown,
  ): Promise<boolean> {
    if (busy.current) return false;
    busy.current = true; last.current = {path,method,body};
    setPending(true);
    setError("");
    setMessage("");
    try {
      await fetchJson(path, administrationSchema, {
        method,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      setMessage("Saved");
      onChanged();
      return true;
    } catch {
      setError("Couldn’t save.");
      return false;
    } finally {
      busy.current = false; setPending(false);
    }
  }
  return { pending, error, message, run, retry: () => { if (last.current) void run(last.current.path,last.current.method,last.current.body); }, reload: onChanged };
}
export type AdministrationAction = ReturnType<typeof useAdministrationAction>;
