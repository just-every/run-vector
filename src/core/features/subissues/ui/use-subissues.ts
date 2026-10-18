import { useEffect, useRef, useState } from "react";
import { ApiError, fetchJson, useApiResource } from "../../../app/api-client";
import {
  subissueRuleSchema,
  subissuesSchema,
  type SubissuesData,
} from "../schema";
import { issueDetailSchema } from "../../issues/ui/data";
export function useSubissues(
  identifier: string,
  version: number,
  onRefresh: () => void,
) {
  const url = `/api/issues/${encodeURIComponent(identifier)}/subissues`,
    resource = useApiResource(url, subissuesSchema, 5000);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const mutation = useRef(false),
    previousVersion = useRef(version);
  useEffect(() => {
    if (previousVersion.current !== version) {
      previousVersion.current = version;
      resource.refreshAfterMutation();
    }
  }, [version, resource.refreshAfterMutation]);
  async function run(
    work: () => Promise<SubissuesData | void>,
    success: string,
  ) {
    if (mutation.current) return false;
    mutation.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const receipt = await work();
      if (receipt) resource.publishReceipt(() => receipt);
      resource.refreshAfterMutation();
      onRefresh();
      setMessage(success);
      return true;
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 409
          ? "The issue or sub-issues changed. Your entry is kept; refresh and review before trying again."
          : cause instanceof Error
            ? cause.message
            : "The sub-issue could not be updated.",
      );
      return false;
    } finally {
      mutation.current = false;
      setPending(false);
    }
  }
  const json = (method: string, body: unknown) => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    ...resource,
    pending,
    error: error || resource.error?.message || "",
    message,
    refresh: () => {
      setError("");
      resource.reload();
      onRefresh();
    },
    create: (title: string) =>
      run(
        () =>
          fetchJson(
            url,
            subissuesSchema,
            json("POST", { expectedVersion: resource.data!.version, title }),
          ),
        "Sub-issue created.",
      ),
    reorder: (identifiers: string[]) =>
      run(
        () =>
          fetchJson(
            url,
            subissuesSchema,
            json("PATCH", {
              expectedVersion: resource.data!.version,
              identifiers,
            }),
          ),
        "Sub-issue order saved.",
      ),
    convert: (child: SubissuesData["children"][number]) =>
      run(async () => {
        await fetchJson(
          `/api/issues/${encodeURIComponent(child.identifier)}/parent`,
          issueDetailSchema,
          json("PATCH", {
            expectedVersion: child.version,
            parentIdentifier: null,
          }),
        );
      }, `${child.identifier} converted to a root issue.`),
    addExisting: (childIdentifier: string) =>
      run(async () => {
        const child = await fetchJson(
          `/api/issues/${encodeURIComponent(childIdentifier)}`,
          issueDetailSchema,
        );
        await fetchJson(
          `/api/issues/${encodeURIComponent(child.identifier)}/parent`,
          issueDetailSchema,
          json("PATCH", {
            expectedVersion: child.version,
            parentIdentifier: identifier,
          }),
        );
      }, "Existing issue added as a sub-issue."),
    setRule: (enabled: boolean) =>
      run(async () => {
        const data = resource.data!;
        const rule = await fetchJson(
          `/api/teams/${encodeURIComponent(data.teamId)}/subissue-rule`,
          subissueRuleSchema,
          json("PATCH", { expectedVersion: data.rule.version, enabled }),
        );
        return { ...data, rule };
      }, "Team sub-issue rule updated."),
  };
}
