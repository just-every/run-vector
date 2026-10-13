import type { IssueListQuery } from "./list-schema";
export class PaginationInvalidated extends Error {
  readonly code = "pagination_invalidated";
  readonly status = 409;
  constructor() {
    super("Issues changed. Restart pagination from the first page.");
  }
}
/** The scope digest prevents reuse with different filters, ordering or dates. */
export async function resultRevision(
  query: IssueListQuery,
  workspace: string,
  today: string,
  revision: string,
) {
  const { offset: _offset, revision: _revision, ...scope } = query;
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([workspace, today, scope])),
  );
  const hash = Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return `${revision}:${hash}`;
}
