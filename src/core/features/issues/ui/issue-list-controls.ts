import { issueListQuerySchema, type IssueListQuery } from "../list-schema.ts";

export const defaultIssueListQuery = issueListQuerySchema.parse({});
export function issueListLayoutQuery(
  query: IssueListQuery,
  layout: "list" | "board",
) {
  return layout === "board" &&
    (query.pageSize !== 100 || query.grouping !== "status")
    ? { ...query, pageSize: 100 as const, grouping: "status" as const }
    : query;
}
export function issueListSearch(query: IssueListQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== defaultIssueListQuery[key as keyof IssueListQuery])
      params.set(key, String(value));
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}
export function issueListApiUrl(query: IssueListQuery) {
  return "/api/issues" + issueListSearch(query);
}
export function issueListReturnPath(query: IssueListQuery) {
  return "/app/issues" + issueListSearch(query);
}
export function changeIssueListFilters(
  query: IssueListQuery,
  changes: Partial<IssueListQuery>,
) {
  return issueListQuerySchema.parse({
    ...query,
    ...changes,
    offset: changes.offset ?? 0,
    revision: changes.offset !== undefined ? (changes.revision ?? query.revision) : "",
  });
}
