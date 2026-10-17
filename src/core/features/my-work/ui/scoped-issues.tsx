import { useMatch, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { fetchJson } from "../../../app/api-client";
import { IssueBrowserPane } from "../../issues/ui/issue-browser-pane";
import { IssueBrowserSurface } from "../../issues/ui/issues-browser";
import { changeIssueListFilters, defaultIssueListQuery } from "../../issues/ui/issue-list-controls";
import type { IssueListQuery } from "../../issues/list-schema";
import { subscriptionSchema } from "../../notifications/ui/data";
import { MyWorkTabs } from "./my-work-tabs";

const copy = {
  created: { title: "Created", tab: "Created", description: "Every issue you created, newest first." },
  subscribed: { title: "Subscribed", tab: "Subscribed", description: "Every issue you follow. Unfollow to remove one." },
} as const;

/** Created and Subscribed take the issue views' filters, display and Save view;
 * the scope stays fixed to the tab whatever the controls change. */
export function MyScopedIssues({ scope }: { scope: "created" | "subscribed" }) {
  const base = scope === "created" ? "/app/my-work/created" : "/app/my-work/subscribed";
  const query = useSearch({ from: base }) as IssueListQuery,
    navigate = useNavigate();
  const opened = useMatch({ from: `${base}/$identifier`, shouldThrow: false })?.params.identifier ?? null;
  const change = (changes: Partial<IssueListQuery>) => {
    const search = changeIssueListFilters(query, { ...changes, scope });
    void (opened
      ? navigate({ to: `${base}/$identifier`, params: { identifier: opened }, search })
      : navigate({ to: base, search }));
  };
  return (
    <IssueBrowserPane identifier={opened} onClose={() => navigate({ to: base, search: query })}>
      <IssueBrowserSurface
        query={query}
        layout="list"
        title={copy[scope].title}
        description={copy[scope].description}
        before={<MyWorkTabs current={copy[scope].tab} />}
        switchLayout={false}
        onChange={change}
        onReset={() => change({ ...defaultIssueListQuery })}
        onOpen={(identifier) => void navigate({ to: `${base}/$identifier`, params: { identifier }, search: query })}
        rowAction={scope === "subscribed" ? (issue, refresh) => <Unfollow identifier={issue.identifier} onDone={refresh} /> : undefined}
      />
    </IssueBrowserPane>
  );
}

function Unfollow({ identifier, onDone }: { identifier: string; onDone: () => void }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function unfollow() {
    setPending(true);
    setError("");
    try {
      await fetchJson(`/api/issues/${encodeURIComponent(identifier)}/subscription`, subscriptionSchema, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ following: false }),
      });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not unfollow.");
      setPending(false);
    }
  }
  return (
    <>
      <button type="button" disabled={pending} aria-label={`Unfollow ${identifier}`} onClick={() => void unfollow()}>
        {pending ? "Unfollowing…" : "Unfollow"}
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </>
  );
}
