export class DescriptionMutationError extends Error {
  constructor(readonly code: "stale_version" | "stale_body" | "not_found" | "forbidden", readonly status: 403 | 404 | 409, message: string) {
    super(message);
  }
}
