export class DescriptionMutationError extends Error {
  constructor(readonly code: "stale_version" | "stale_body" | "not_found" | "forbidden", readonly status: 403 | 404 | 409, message: string, readonly comment?: { id: string; body: string; version: number }) {
    super(message);
  }
}
