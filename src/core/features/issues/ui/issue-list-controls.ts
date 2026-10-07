import { issueListQuerySchema, type IssueListQuery } from "../list-schema.ts";

export const defaultIssueListQuery = issueListQuerySchema.parse({});
export function issueListSearch(query: IssueListQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category !== "all") params.set("category", query.category);
  if (query.assignee !== "all") params.set("assignee", query.assignee);
  if (query.offset) params.set("offset", String(query.offset));
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
  });
}
